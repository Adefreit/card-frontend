import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../auth/auth-context";
import { getTransactions, type TransactionRecord } from "../api";

function formatDate(value?: string) {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(cents?: number, currency?: string) {
  if (typeof cents !== "number" || Number.isNaN(cents)) {
    return "Unavailable";
  }

  const safeCurrency = (currency || "usd").toUpperCase();
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: safeCurrency,
  }).format(cents / 100);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function getNumberField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function getLatestTransaction(records: TransactionRecord[]) {
  return [...records]
    .filter((tx) => Boolean(tx.create_time))
    .sort((a, b) => {
      const aTime = new Date(a.create_time ?? "").getTime();
      const bTime = new Date(b.create_time ?? "").getTime();
      return bTime - aTime;
    })[0];
}

function formatOrderType(orderType?: string) {
  if (!orderType) {
    return "Purchase";
  }

  if (orderType === "purchase_item") {
    return "Card Pack Purchase";
  }

  return orderType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PaymentSuccessPage() {
  const queryClient = useQueryClient();
  const { refreshAccountProfile } = useAuth();
  const hasHydratedRef = useRef(false);

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });

  useEffect(() => {
    if (hasHydratedRef.current) {
      return;
    }

    hasHydratedRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ["cards"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void refreshAccountProfile();
  }, [queryClient, refreshAccountProfile]);

  const receiptData = useMemo(() => {
    const latest = getLatestTransaction(transactionsQuery.data ?? []);
    if (!latest) {
      return null;
    }

    const source = asRecord(latest) ?? {};
    const amountCents = getNumberField(source, [
      "amount_total",
      "amountTotal",
      "total_amount",
      "totalAmount",
      "amount",
    ]);
    const currency = getStringField(source, ["currency", "currency_code"]);
    const itemDescription = getStringField(source, [
      "description",
      "item_description",
      "itemDescription",
      "product_name",
      "productName",
      "product_id",
      "productId",
    ]);

    return {
      id: latest.id,
      type: formatOrderType(latest.order_type),
      status: latest.status ?? "completed",
      createdAt: formatDate(latest.create_time),
      total: formatMoney(amountCents, currency),
      itemDescription: itemDescription ?? "See transaction record",
      rawCurrency: currency?.toUpperCase() ?? "USD",
    };
  }, [transactionsQuery.data]);

  return (
    <div className="page-stack payment-success-page">
      <section className="content-hero payment-success-hero">
        <div>
          <h1>Payment successful</h1>
          <p className="content-hero-copy">
            Victory! Your payment is complete and your account is updated. A
            purchase summary has also been emailed to you.
          </p>
        </div>
      </section>

      <section className="content-card payment-receipt-card" aria-live="polite">
        <div className="content-card-header row-between">
          <div>
            <h2>Receipt</h2>
            <p>Summary of your most recent transaction.</p>
          </div>
        </div>

        {transactionsQuery.isLoading ? (
          <p className="dash-loading">Loading receipt...</p>
        ) : null}

        {transactionsQuery.isError ? (
          <p className="alert-error">
            We could not load receipt details right now. Your payment still
            completed successfully.
          </p>
        ) : null}

        {!transactionsQuery.isLoading && !transactionsQuery.isError ? (
          receiptData ? (
            <dl className="payment-receipt-grid">
              <div>
                <dt>Transaction ID</dt>
                <dd>{receiptData.id}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{receiptData.type}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className="payment-receipt-status">
                  {receiptData.status.toUpperCase()}
                </dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{receiptData.createdAt}</dd>
              </div>
              <div>
                <dt>Item</dt>
                <dd>{receiptData.itemDescription}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  <strong>{receiptData.total}</strong>
                  <span className="payment-receipt-currency">
                    {receiptData.rawCurrency}
                  </span>
                </dd>
              </div>
            </dl>
          ) : (
            <p>
              Your purchase is complete. Receipt details are being finalized,
              and a summary has been emailed to you.
            </p>
          )
        ) : null}
      </section>

      <div className="payment-success-actions payment-success-actions--bottom">
        <button
          type="button"
          className="btn-secondary payment-success-btn"
          onClick={() => window.print()}
        >
          Print Receipt
        </button>
        <Link className="btn-primary payment-success-btn" to="/app/dashboard">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
