import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { getCurrentUserProfile } from "../auth/api";
import { decodeJwtPayload, getPermissionsFromJwt } from "../../lib/jwt";
import {
  cancelTransaction,
  createIdempotencyKey,
  createTransaction,
  getCheckoutRedirectUrl,
  getPricing,
  getTransactions,
  resumeTransaction,
} from "../transactions/api";
import PlanComparisonTable from "../subscription/components/PlanComparisonTable";

function isActiveSubscription(expiresAt?: string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt) > new Date();
}

function formatAccountCreatedDate(value?: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return parsed.toLocaleString();
}

function formatSubscriptionLevel(value?: string | null) {
  if (!value) {
    return "Free";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getSubscriptionStatusLabel(state: SubscriptionLifecycleState) {
  switch (state) {
    case "active":
      return "Active";
    case "scheduled":
      return "Cancellation Scheduled";
    case "cancelled":
      return "Cancelled";
    default:
      return "Not subscribed";
  }
}

type SubscriptionLifecycleState = "active" | "scheduled" | "cancelled" | "none";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { token, userId, accountSubscriptionUntil, refreshAccountProfile } =
    useAuth();
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [subscriptionType, setSubscriptionType] = useState("");

  const jwtPayload = useMemo(() => decodeJwtPayload(token), [token]);
  const jwtPermissions = useMemo(
    () => getPermissionsFromJwt(jwtPayload),
    [jwtPayload],
  );
  const hasFounderPermission = jwtPermissions.includes("FOUNDER");
  const jwtEmail = useMemo(() => {
    if (!jwtPayload || typeof jwtPayload !== "object") {
      return null;
    }

    const emailValue = (jwtPayload as Record<string, unknown>).email;
    return typeof emailValue === "string" ? emailValue : null;
  }, [jwtPayload]);
  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });
  const userProfileQuery = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => getCurrentUserProfile(userId as string),
    enabled: Boolean(userId),
  });
  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: getPricing,
  });

  const accountCreatedValue = formatAccountCreatedDate(
    userProfileQuery.data?.create_time ??
      userProfileQuery.data?.created_at ??
      userProfileQuery.data?.createdAt ??
      null,
  );
  const accountEmail =
    userProfileQuery.data?.email ?? jwtEmail ?? "Unavailable";
  const subscriptionLevel = formatSubscriptionLevel(
    userProfileQuery.data?.subscription_type,
  );
  const latestSubscriptionTransaction = useMemo(() => {
    const subscriptionTransactions = (transactionsQuery.data ?? []).filter(
      (tx) => tx.order_type === "subscription",
    );

    return (
      subscriptionTransactions.slice().sort((a, b) => {
        const aTime = new Date(a.create_time ?? "").getTime();
        const bTime = new Date(b.create_time ?? "").getTime();
        return bTime - aTime;
      })[0] ?? null
    );
  }, [transactionsQuery.data]);

  const subscriptionLifecycle = useMemo(() => {
    const status = (latestSubscriptionTransaction?.status ?? "").toLowerCase();
    const cancelAtPeriodEnd =
      latestSubscriptionTransaction?.cancel_at_period_end === true;

    if (status === "cancelled" || status === "canceled") {
      return {
        state: "cancelled" as SubscriptionLifecycleState,
        cancellationEffectiveAt:
          latestSubscriptionTransaction?.cancellation_effective_at ?? null,
        canCancel: false,
      };
    }

    if (status === "paid" && cancelAtPeriodEnd) {
      return {
        state: "scheduled" as SubscriptionLifecycleState,
        cancellationEffectiveAt:
          latestSubscriptionTransaction?.cancellation_effective_at ?? null,
        canCancel: false,
      };
    }

    if (status === "paid") {
      return {
        state: "active" as SubscriptionLifecycleState,
        cancellationEffectiveAt:
          latestSubscriptionTransaction?.cancellation_effective_at ?? null,
        canCancel: Boolean(latestSubscriptionTransaction),
      };
    }

    return {
      state: "none" as SubscriptionLifecycleState,
      cancellationEffectiveAt:
        latestSubscriptionTransaction?.cancellation_effective_at ?? null,
      canCancel: false,
    };
  }, [latestSubscriptionTransaction]);

  const hasActiveSubscriptionFallback = isActiveSubscription(
    accountSubscriptionUntil,
  );
  const isMembershipActive =
    subscriptionLifecycle.state === "active" ||
    subscriptionLifecycle.state === "scheduled" ||
    (subscriptionLifecycle.state === "none" && hasActiveSubscriptionFallback);
  const isCancellationScheduled = subscriptionLifecycle.state === "scheduled";
  const shouldShowCancelButton =
    subscriptionLifecycle.state === "active" &&
    subscriptionLifecycle.canCancel &&
    Boolean(latestSubscriptionTransaction);

  const subscriptionExpirationValue = formatAccountCreatedDate(
    subscriptionLifecycle.state === "scheduled"
      ? (subscriptionLifecycle.cancellationEffectiveAt ??
          userProfileQuery.data?.account_subscription_until ??
          accountSubscriptionUntil ??
          null)
      : (userProfileQuery.data?.account_subscription_until ??
          accountSubscriptionUntil ??
          null),
  );
  const selectedPlan = useMemo(
    () =>
      pricingQuery.data?.subscriptionTypes.find(
        (plan) => plan.id === subscriptionType,
      ) ?? null,
    [pricingQuery.data?.subscriptionTypes, subscriptionType],
  );

  useEffect(() => {
    const plans = pricingQuery.data?.subscriptionTypes;
    if (!plans || plans.length === 0 || subscriptionType) {
      return;
    }

    setSubscriptionType(plans[0].id);
  }, [pricingQuery.data?.subscriptionTypes, subscriptionType]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    if (interval === "month" && !selectedPlan.prices.monthly) {
      setInterval(selectedPlan.prices.yearly ? "year" : "month");
      return;
    }

    if (interval === "year" && !selectedPlan.prices.yearly) {
      setInterval(selectedPlan.prices.monthly ? "month" : "year");
    }
  }, [selectedPlan, interval]);

  const subscribeMutation = useMutation({
    mutationFn: () =>
      createTransaction({
        transactionType: "subscription",
        idempotencyKey: createIdempotencyKey(),
        currency: "usd",
        subscription: { subscriptionType, interval },
      }),
    onSuccess: (result) => {
      const checkoutUrl = getCheckoutRedirectUrl(result);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void refreshAccountProfile();
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!latestSubscriptionTransaction) {
        throw new Error("No active subscription transaction found.");
      }

      return cancelTransaction(latestSubscriptionTransaction.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await refreshAccountProfile();
    },
  });

  const resumeSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!latestSubscriptionTransaction) {
        throw new Error("No scheduled subscription transaction found.");
      }

      return resumeTransaction(latestSubscriptionTransaction.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await refreshAccountProfile();
    },
  });

  return (
    <div className="page-stack">
      <section className="content-hero">
        <div>
          <h1>Account settings</h1>
          <p className="content-hero-copy">
            Manage your account subscription and billing preferences.
          </p>
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">User Information</h2>
          <span className="meta-pill">Profile</span>
        </div>

        {userProfileQuery.isError ? (
          <p className="alert-error">Failed to load user profile details.</p>
        ) : null}

        <div className="detail-meta-grid" style={{ marginTop: 4 }}>
          <div className="detail-meta-item">
            <span>Email Address</span>
            <strong>
              {userProfileQuery.isLoading ? "Loading..." : accountEmail}
            </strong>
          </div>
          <div className="detail-meta-item">
            <span>Account Created</span>
            <strong>
              {userProfileQuery.isLoading ? "Loading..." : accountCreatedValue}
            </strong>
          </div>
        </div>

        {hasFounderPermission ? (
          <p className="alert-success" style={{ marginTop: 8 }}>
            Thank you for being a Founder. Your early support means a lot.
          </p>
        ) : null}
      </section>

      <section className="dash-panel">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Membership Details</h2>
          <span className="meta-pill">
            {getSubscriptionStatusLabel(subscriptionLifecycle.state)}
          </span>
        </div>

        <div className="detail-meta-grid" style={{ marginTop: 4 }}>
          <div className="detail-meta-item">
            <span>Subscription Level</span>
            <strong>
              {userProfileQuery.isLoading ? "Loading..." : subscriptionLevel}
            </strong>
          </div>
          <div className="detail-meta-item">
            <span>Subscription Expires</span>
            <strong>
              {userProfileQuery.isLoading
                ? "Loading..."
                : subscriptionExpirationValue}
            </strong>
          </div>
        </div>

        {subscriptionLifecycle.state === "cancelled" ? (
          <p style={{ marginTop: 8, color: "var(--ui-muted)" }}>
            This subscription has been cancelled.
          </p>
        ) : null}

        {transactionsQuery.isError ? (
          <p className="alert-error">Failed to load transaction history.</p>
        ) : null}

        <PlanComparisonTable
          plans={pricingQuery.data?.subscriptionTypes ?? []}
          selectedPlanId={subscriptionType}
          onSelectPlan={setSubscriptionType}
          selectedInterval={interval}
          onSelectInterval={setInterval}
          onStartSubscription={() => {
            if (isCancellationScheduled) {
              resumeSubscriptionMutation.mutate();
              return;
            }

            subscribeMutation.mutate();
          }}
          isStartPending={
            subscribeMutation.isPending || resumeSubscriptionMutation.isPending
          }
          isSubscribed={isMembershipActive}
          mintPrice={pricingQuery.data?.mint ?? null}
        />

        {isCancellationScheduled ? (
          <div className="button-row" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => resumeSubscriptionMutation.mutate()}
              disabled={
                resumeSubscriptionMutation.isPending ||
                !latestSubscriptionTransaction
              }
            >
              {resumeSubscriptionMutation.isPending
                ? "Resuming..."
                : "Resume Subscription"}
            </button>
          </div>
        ) : null}

        {shouldShowCancelButton ? (
          <div className="button-row" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="btn-danger"
              onClick={() => cancelSubscriptionMutation.mutate()}
              disabled={cancelSubscriptionMutation.isPending}
            >
              {cancelSubscriptionMutation.isPending
                ? "Canceling..."
                : "Cancel Subscription"}
            </button>
          </div>
        ) : null}

        {pricingQuery.isError ? (
          <p className="alert-error">
            Failed to load pricing details. Subscription checkout is temporarily
            unavailable.
          </p>
        ) : null}
        {subscribeMutation.isError ? (
          <p className="alert-error">Failed to start subscription.</p>
        ) : null}
        {cancelSubscriptionMutation.isError ? (
          <p className="alert-error">Failed to cancel subscription.</p>
        ) : null}
        {resumeSubscriptionMutation.isError ? (
          <p className="alert-error">Failed to resume subscription.</p>
        ) : null}
      </section>

      <section className="dash-panel">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Debug Information</h2>
          <span className="meta-pill">Debug</span>
        </div>

        <div className="detail-meta-grid" style={{ marginTop: 4 }}>
          <div className="detail-meta-item" style={{ gridColumn: "1 / -1" }}>
            <span>User ID</span>
            <strong>{userId ?? "Unavailable"}</strong>
          </div>
          <div className="detail-meta-item" style={{ gridColumn: "1 / -1" }}>
            <span>Current Session Token</span>
            <pre
              style={{
                margin: "6px 0 0",
                fontSize: "0.78rem",
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              {token ?? "No token available."}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
