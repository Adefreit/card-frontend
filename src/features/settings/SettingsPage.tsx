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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { token, userId, accountSubscriptionUntil, refreshAccountProfile } =
    useAuth();
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [subscriptionType, setSubscriptionType] = useState("");

  const isSubscribed = isActiveSubscription(accountSubscriptionUntil);
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

  const subscriptionTransaction = useMemo(() => {
    return (
      transactionsQuery.data?.find(
        (tx) =>
          tx.order_type === "subscription" &&
          tx.status !== "cancelled" &&
          tx.status !== "canceled",
      ) ?? null
    );
  }, [transactionsQuery.data]);

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

      void refreshAccountProfile();
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!subscriptionTransaction) {
        throw new Error("No active subscription transaction found.");
      }

      return cancelTransaction(subscriptionTransaction.id);
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
            {isSubscribed ? "Active" : "Not subscribed"}
          </span>
        </div>

        <p style={{ marginTop: 0 }}>
          {isSubscribed && accountSubscriptionUntil
            ? `Your subscription is active until ${new Date(accountSubscriptionUntil).toLocaleDateString()}.`
            : "You currently do not have an active subscription."}
        </p>

        {transactionsQuery.isError ? (
          <p className="alert-error">Failed to load transaction history.</p>
        ) : null}

        <PlanComparisonTable
          plans={pricingQuery.data?.subscriptionTypes ?? []}
          selectedPlanId={subscriptionType}
          onSelectPlan={setSubscriptionType}
          selectedInterval={interval}
          onSelectInterval={setInterval}
          onStartSubscription={() => subscribeMutation.mutate()}
          isStartPending={subscribeMutation.isPending}
          isSubscribed={isSubscribed}
          mintPrice={pricingQuery.data?.mint ?? null}
        />

        {isSubscribed ? (
          <div className="button-row" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="btn-danger"
              onClick={() => cancelSubscriptionMutation.mutate()}
              disabled={
                cancelSubscriptionMutation.isPending || !subscriptionTransaction
              }
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
      </section>

      <section className="dash-panel">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Debug Information</h2>
          <span className="meta-pill">Debug</span>
        </div>
        <p className="muted-copy" style={{ margin: "0 0 8px" }}>
          Current session token:
        </p>
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--ui-border)",
            background: "rgba(247, 249, 255, 0.92)",
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
      </section>
    </div>
  );
}
