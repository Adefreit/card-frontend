import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { decodeJwtPayload, getPermissionsFromJwt } from "../../lib/jwt";
import {
  cancelTransaction,
  createIdempotencyKey,
  createTransaction,
  getCheckoutRedirectUrl,
  getTransactions,
} from "../transactions/api";

function isActiveSubscription(expiresAt?: string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt) > new Date();
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { token, accountSubscriptionUntil, refreshAccountProfile } = useAuth();
  const [interval, setInterval] = useState<"month" | "year">("year");

  const isSubscribed = isActiveSubscription(accountSubscriptionUntil);
  const jwtPayload = useMemo(() => decodeJwtPayload(token), [token]);
  const jwtPermissions = useMemo(
    () => getPermissionsFromJwt(jwtPayload),
    [jwtPayload],
  );
  const hasFounderPermission = jwtPermissions.includes("FOUNDER");

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });

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

  const subscribeMutation = useMutation({
    mutationFn: () =>
      createTransaction({
        transactionType: "subscription",
        idempotencyKey: createIdempotencyKey(),
        currency: "usd",
        subscription: { interval },
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
          <h2 className="dash-panel-title">Subscription</h2>
          <span className="meta-pill">
            {isSubscribed ? "Active" : "Not subscribed"}
          </span>
        </div>

        <p style={{ marginTop: 0 }}>
          {isSubscribed && accountSubscriptionUntil
            ? `Your subscription is active until ${new Date(accountSubscriptionUntil).toLocaleDateString()}.`
            : "You currently do not have an active subscription."}
        </p>

        {hasFounderPermission ? (
          <p className="alert-success" style={{ marginTop: 8 }}>
            Thank you for being a Founder. Your early support means a lot.
          </p>
        ) : null}

        {transactionsQuery.isError ? (
          <p className="alert-error">Failed to load transaction history.</p>
        ) : null}

        {!isSubscribed ? (
          <div className="button-row" style={{ justifyContent: "flex-start" }}>
            <label>
              <span>Billing interval</span>
              <select
                value={interval}
                onChange={(event) =>
                  setInterval(event.target.value as "month" | "year")
                }
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </label>
            <button
              type="button"
              className="btn-primary"
              onClick={() => subscribeMutation.mutate()}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending
                ? "Redirecting..."
                : "Start Subscription"}
            </button>
          </div>
        ) : null}

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

        {subscribeMutation.isError ? (
          <p className="alert-error">Failed to start subscription.</p>
        ) : null}
        {cancelSubscriptionMutation.isError ? (
          <p className="alert-error">Failed to cancel subscription.</p>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px" }}>Debug JWT</h3>
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
              maxHeight: 180,
              overflow: "auto",
            }}
          >
            {token ?? "No token available."}
          </pre>
        </div>
      </section>
    </div>
  );
}
