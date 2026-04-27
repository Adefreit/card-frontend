import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  type AdminFulfillmentStage,
  getAdminOrder,
  refundAdminOrder,
  updateAdminOrderFulfillmentStage,
  type AdminOrderFulfillmentNote,
  type AdminOrderItem,
  type AdminOrderRecord,
} from "../api";

const STAGE_ORDER = [
  "pending",
  "preparing",
  "on_hold",
  "complete",
  "cancelled",
] as const;

type FulfillmentStage = AdminFulfillmentStage;

type ParsedIncludedEntry = {
  label: string;
  quantity: number;
};

function formatDate(value?: string | null | Date) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function safeJsonStringify(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(
      value,
      (_key, currentValue) => {
        if (typeof currentValue === "bigint") {
          return currentValue.toString();
        }

        if (typeof currentValue === "function") {
          return `[Function ${currentValue.name || "anonymous"}]`;
        }

        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }

        if (typeof currentValue === "object" && currentValue !== null) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }

        return currentValue;
      },
      2,
    );
  } catch (error) {
    return JSON.stringify(
      {
        error: "Unable to serialize raw data safely.",
        reason: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    );
  }
}

function sanitizeForDisplay(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return value.length > 2000
      ? `${value.slice(0, 2000)}… [truncated ${value.length - 2000} chars]`
      : value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (depth >= 6) {
    return "[Max depth reached]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .slice(0, 50)
      .map((item) => sanitizeForDisplay(item, depth + 1, seen));

    if (value.length > 50) {
      sanitizedItems.push(`[${value.length - 50} more items truncated]`);
    }

    return sanitizedItems;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  const limitedEntries = entries.slice(0, 60);
  const result: Record<string, unknown> = {};

  for (const [key, entryValue] of limitedEntries) {
    result[key] = sanitizeForDisplay(entryValue, depth + 1, seen);
  }

  if (entries.length > 60) {
    result.__truncated__ = `${entries.length - 60} more keys omitted`;
  }

  return result;
}

function formatCents(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `$${(value / 100).toFixed(2)}`;
}

function humanizeText(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

function capitalize(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

function toLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractIncludedEntries(item: AdminOrderItem): ParsedIncludedEntry[] {
  const itemRecord = item as Record<string, unknown>;
  const candidateContainers = [
    itemRecord.options,
    itemRecord.metadata,
    itemRecord.print_options,
  ];
  const candidateArrayKeys = [
    "cards",
    "card_ids",
    "cardIds",
    "deck_cards",
    "deckCards",
    "included_cards",
    "contents",
    "items",
  ];
  const found: ParsedIncludedEntry[] = [];

  const tryPush = (label: string | null, quantityValue: unknown) => {
    if (!label) return;
    found.push({ label, quantity: toQty(quantityValue) });
  };

  const visitArray = (entries: unknown[]) => {
    for (const entry of entries) {
      if (typeof entry === "string") {
        tryPush(toLabel(entry), 1);
        continue;
      }
      const entryRecord = asRecord(entry);
      if (!entryRecord) continue;
      const label =
        toLabel(entryRecord.title) ||
        toLabel(entryRecord.name) ||
        toLabel(entryRecord.card_name) ||
        toLabel(entryRecord.cardTitle) ||
        toLabel(entryRecord.cardId) ||
        toLabel(entryRecord.product_id) ||
        toLabel(entryRecord.id);
      tryPush(
        label,
        entryRecord.quantity ?? entryRecord.qty ?? entryRecord.count,
      );
    }
  };

  for (const container of candidateContainers) {
    const containerRecord = asRecord(container);
    if (!containerRecord) continue;
    for (const key of candidateArrayKeys) {
      const value = containerRecord[key];
      if (Array.isArray(value)) visitArray(value);
    }
  }

  const deduped = new Map<string, ParsedIncludedEntry>();
  for (const entry of found) {
    const existing = deduped.get(entry.label);
    if (existing) existing.quantity += entry.quantity;
    else deduped.set(entry.label, { ...entry });
  }
  return [...deduped.values()];
}

function getItemTitle(item: AdminOrderItem) {
  const itemRecord = item as Record<string, unknown>;
  const metadata = asRecord(itemRecord.metadata);
  const options = asRecord(itemRecord.options);
  return (
    (toLabel(itemRecord.title) as string | null) ||
    (toLabel(metadata?.title) as string | null) ||
    (toLabel(metadata?.name) as string | null) ||
    (toLabel(options?.title) as string | null) ||
    (toLabel(options?.name) as string | null) ||
    (toLabel(itemRecord.product_id) as string | null) ||
    (toLabel(itemRecord.item_type) as string | null) ||
    "Order Item"
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <span
      className="admin-copy-value"
      onClick={handleCopy}
      title="Click to copy"
    >
      <span>{value}</span>
      <span className="admin-copy-value__hint">
        {copied ? "Copied" : "Click to copy"}
      </span>
    </span>
  );
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const locationOrder = (location.state as { order?: AdminOrderRecord } | null)
    ?.order;

  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] =
    useState<FulfillmentStage>("pending");
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [orderFallback, setOrderFallback] = useState<AdminOrderRecord | null>(
    locationOrder ?? null,
  );

  // Refund modal state
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundCents, setRefundCents] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [stageMetadataText, setStageMetadataText] = useState(
    '{"source":"admin_ui"}',
  );

  const orderQuery = useQuery({
    queryKey: ["admin", "order", orderId],
    queryFn: () => getAdminOrder(orderId as string),
    enabled: Boolean(orderId),
    retry: 1,
  });

  useEffect(() => {
    if (locationOrder) setOrderFallback(locationOrder);
  }, [locationOrder, orderId]);

  const order = orderQuery.data?.order ?? orderFallback;
  const relatedUser = orderQuery.data?.user ?? null;
  const relatedCards = orderQuery.data?.cards ?? [];
  const fulfillmentNotes = orderQuery.data?.fulfillmentNotes ?? [];

  useEffect(() => {
    if (!order) return;
    const fallback = (order.fulfillment_stage as FulfillmentStage) ?? "pending";
    setSelectedStage(fallback);
    setConfirmAdvance(false);
    setStageNote("");
  }, [order]);

  // Pre-fill refund amount when order loads
  useEffect(() => {
    if (!order) return;
    const remaining =
      (order.total_cents ?? 0) - (order.refund_total_cents ?? 0);
    setRefundCents(Math.max(0, remaining));
  }, [order]);

  const stageMutation = useMutation({
    mutationFn: (stage: FulfillmentStage) => {
      let parsedMetadata: Record<string, unknown> | undefined;

      if (stageMetadataText.trim()) {
        try {
          const metadata = JSON.parse(stageMetadataText);
          if (
            metadata &&
            typeof metadata === "object" &&
            !Array.isArray(metadata)
          ) {
            parsedMetadata = metadata as Record<string, unknown>;
          } else {
            throw new Error("Metadata must be a JSON object.");
          }
        } catch {
          throw new Error("Stage metadata must be valid JSON.");
        }
      }

      return updateAdminOrderFulfillmentStage(
        orderId as string,
        stage,
        stageNote,
        parsedMetadata,
      );
    },
    onSuccess: async () => {
      setMutationMessage("Order fulfillment stage updated successfully.");
      setConfirmAdvance(false);
      setStageNote("");
      setOrderFallback((prev) =>
        prev
          ? {
              ...prev,
              fulfillment_stage: selectedStage,
              fulfillment_update_time: new Date().toISOString(),
            }
          : prev,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "order", orderId],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
      ]);
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const responseData = error.response?.data as
          | { response?: string; message?: string; error?: string }
          | undefined;
        const apiMessage =
          responseData?.message ??
          responseData?.response ??
          responseData?.error;

        if (apiMessage) {
          setMutationMessage(apiMessage);
          return;
        }
      }

      if (error instanceof Error) {
        setMutationMessage(error.message);
        return;
      }

      setMutationMessage("Failed to update order stage.");
    },
  });

  const refundMutation = useMutation({
    mutationFn: () =>
      refundAdminOrder(orderId as string, refundCents, refundReason),
    onSuccess: async () => {
      setMutationMessage("Refund issued successfully.");
      setRefundOpen(false);
      setRefundReason("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "order", orderId],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
      ]);
    },
    onError: () => {
      setMutationMessage(
        "Refund failed. Please check the amount and try again.",
      );
    },
  });

  if (!orderId) return <Navigate to="/app/admin/orders" replace />;

  // Parse metadata.cards if present
  const metadataCards: Array<Record<string, unknown>> = (() => {
    const meta = asRecord(order?.metadata);
    if (!meta) return [];
    const cards = meta.cards;
    if (!Array.isArray(cards)) return [];
    return cards
      .map((c) => asRecord(c) ?? {})
      .filter((c) => Object.keys(c).length > 0);
  })();

  const currentStageIdx = order
    ? STAGE_ORDER.indexOf(
        (order.fulfillment_stage ?? "pending") as FulfillmentStage,
      )
    : -1;

  const isTerminalStage =
    order?.fulfillment_stage === "complete" ||
    order?.fulfillment_stage === "cancelled";

  const isDigitalOrder =
    order?.order_type === "mint" || order?.order_type === "subscription";

  const allowedTargets = (() => {
    if (!order?.fulfillment_stage) {
      return new Set<FulfillmentStage>();
    }

    if (order.fulfillment_stage === "complete") {
      return new Set<FulfillmentStage>(["complete"]);
    }

    if (order.fulfillment_stage === "cancelled") {
      return new Set<FulfillmentStage>(["cancelled"]);
    }

    if (isDigitalOrder) {
      return new Set<FulfillmentStage>(["complete", "cancelled"]);
    }

    const transitions: Record<FulfillmentStage, FulfillmentStage[]> = {
      pending: ["preparing", "on_hold", "cancelled"],
      preparing: ["on_hold", "complete", "cancelled"],
      on_hold: ["preparing", "cancelled"],
      complete: [],
      cancelled: [],
    };

    return new Set<FulfillmentStage>(
      transitions[order.fulfillment_stage as FulfillmentStage] ?? [],
    );
  })();

  const canRefund =
    order?.status === "paid" || order?.status === "partially_refunded";

  const cardsFromItems = (order?.items ?? []).flatMap((item) =>
    extractIncludedEntries(item),
  );

  const groupedCardsFromItems = Array.from(
    cardsFromItems.reduce((map, entry) => {
      map.set(entry.label, (map.get(entry.label) ?? 0) + entry.quantity);
      return map;
    }, new Map<string, number>()),
  );

  const summaryWhatWasOrdered =
    order?.order_type === "subscription"
      ? "Subscription"
      : order?.order_type === "mint"
        ? "Minting"
        : metadataCards.length > 0 || groupedCardsFromItems.length > 0
          ? "Card Order"
          : humanizeText(order?.order_type);

  const mintCardIdFromItemMetadata = (order?.items ?? []).find((item) => {
    const metadata = asRecord(item.metadata);
    return Boolean(toLabel(metadata?.cardId) ?? toLabel(metadata?.card_id));
  });

  const resolvedMintCardId =
    order?.mint_card_id ??
    (mintCardIdFromItemMetadata
      ? (() => {
          const metadata = asRecord(mintCardIdFromItemMetadata.metadata);
          return (
            toLabel(metadata?.cardId) ?? toLabel(metadata?.card_id) ?? undefined
          );
        })()
      : undefined);

  const rawSummary = {
    hasResponse: Boolean(orderQuery.data),
    orderType: order?.order_type ?? "-",
    itemCount: order?.items?.length ?? 0,
    relatedCardCount: relatedCards.length,
    metadataCardCount: metadataCards.length,
    responseKeys: orderQuery.data ? Object.keys(orderQuery.data) : [],
  };

  function handleCopyDebugPayload() {
    const debugPayload = safeJsonStringify(sanitizeForDisplay(orderQuery.data));
    void navigator.clipboard.writeText(debugPayload).then(() => {
      setMutationMessage("Debug payload copied to clipboard.");
    });
  }

  function handleLogDebugPayload() {
    console.log(
      "Admin order debug payload",
      sanitizeForDisplay(orderQuery.data),
    );
    setMutationMessage("Debug payload logged to the browser console.");
  }

  function handleDownloadDebugPayload() {
    const debugPayload = safeJsonStringify(sanitizeForDisplay(orderQuery.data));
    const blob = new Blob([debugPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-order-${orderId ?? "unknown"}-debug.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMutationMessage("Debug payload downloaded.");
  }

  return (
    <div className="page-stack admin-page">
      {/* Header */}
      <section className="content-hero">
        <div>
          <h1>Order Details</h1>
          <p className="content-hero-copy">
            Review items, payment, and fulfillment for this order.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/admin/orders">
          ← Back to Orders
        </Link>
      </section>

      <section className="dash-panel admin-card">
        {mutationMessage ? (
          <p className="alert-success" style={{ marginBottom: 16 }}>
            {mutationMessage}
          </p>
        ) : null}

        {orderQuery.isLoading && !order ? (
          <p className="dash-loading">Loading order...</p>
        ) : null}

        {orderQuery.isError && !order ? (
          <p className="alert-error">Unable to load this order right now.</p>
        ) : null}

        {orderQuery.isError && order ? (
          <p className="alert-error" style={{ marginBottom: 12 }}>
            Live refresh failed. Displaying cached data.
          </p>
        ) : null}

        {order ? (
          <>
            {/* ── Section 1: Order Summary ─────────────────────── */}
            <div className="admin-order-section">
              <div className="admin-order-section-header">
                <p className="admin-order-section-title" style={{ margin: 0 }}>
                  Order Summary
                </p>
                <span>
                  <span
                    className={`admin-order-chip admin-order-chip--${order.order_type ?? "other"}`}
                    style={{ marginRight: 8 }}
                  >
                    {humanizeText(order.order_type)}
                  </span>
                  <span
                    className={`admin-order-chip admin-order-chip--${order.status ?? "pending"}`}
                  >
                    {humanizeText(order.status)}
                  </span>
                </span>
              </div>

              <div className="detail-meta-grid">
                <div className="detail-meta-item">
                  <span>Order ID</span>
                  <strong>
                    <CopyValue value={order.id} />
                  </strong>
                </div>
                <div className="detail-meta-item">
                  <span>User</span>
                  <strong>
                    {order.user_id ? (
                      <Link to={`/app/admin/users/${order.user_id}`}>
                        {order.user_id}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </strong>
                </div>
                <div className="detail-meta-item">
                  <span>Email</span>
                  <strong>{relatedUser?.email ?? "-"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span>What Was Ordered</span>
                  <strong>{summaryWhatWasOrdered}</strong>
                </div>
                <div className="detail-meta-item">
                  <span>Cards</span>
                  <strong>
                    {metadataCards.length > 0
                      ? metadataCards
                          .map((card) => {
                            const title =
                              toLabel(card.title) ??
                              toLabel(card.name) ??
                              toLabel(card.id) ??
                              "Card";
                            const qty = toQty(card.quantity ?? card.qty ?? 1);
                            return `${title} x${qty}`;
                          })
                          .join(", ")
                      : groupedCardsFromItems.length > 0
                        ? groupedCardsFromItems
                            .map(([label, qty]) => `${label} x${qty}`)
                            .join(", ")
                        : "-"}
                  </strong>
                </div>
                <div className="detail-meta-item">
                  <span>Created</span>
                  <strong>{formatDate(order.create_time)}</strong>
                </div>
              </div>
            </div>

            {/* ── Section 2: Payment ──────────────────────────── */}
            <div className="admin-order-section">
              <div className="admin-order-section-header">
                <p className="admin-order-section-title" style={{ margin: 0 }}>
                  Payment
                </p>
                <strong className="admin-order-payment-total">
                  {formatCents(order.total_cents)}
                </strong>
              </div>

              <div className="detail-meta-grid" style={{ marginBottom: 14 }}>
                <div className="detail-meta-item">
                  <span>Provider</span>
                  <strong>{capitalize(order.payment_provider)}</strong>
                </div>
                <div className="detail-meta-item">
                  <span>Checkout ID</span>
                  <strong>
                    {order.provider_checkout_id ? (
                      <CopyValue value={order.provider_checkout_id} />
                    ) : (
                      "-"
                    )}
                  </strong>
                </div>
                <div className="detail-meta-item">
                  <span>Currency</span>
                  <strong>{(order.currency ?? "-").toUpperCase()}</strong>
                </div>
                {canRefund ? (
                  <button
                    type="button"
                    className="btn-danger"
                    style={{ padding: "6px 16px", fontSize: "0.85rem" }}
                    onClick={() => setRefundOpen(true)}
                  >
                    Issue Refund
                  </button>
                ) : null}
              </div>

              <details>
                <summary className="admin-order-expand-summary">
                  Show payment details
                </summary>
                <div
                  className="admin-order-money-row"
                  style={{ marginTop: 10 }}
                >
                  <div className="admin-order-money-row__item">
                    <span>Subtotal</span>
                    <strong>{formatCents(order.subtotal_cents)}</strong>
                  </div>
                  <div className="admin-order-money-row__item">
                    <span>Tax</span>
                    <strong>{formatCents(order.tax_cents)}</strong>
                  </div>
                  <div className="admin-order-money-row__item">
                    <span>Shipping</span>
                    <strong>{formatCents(order.shipping_cents)}</strong>
                  </div>
                  <div className="admin-order-money-row__item admin-order-money-row__total">
                    <span>Total</span>
                    <strong>{formatCents(order.total_cents)}</strong>
                  </div>
                  {(order.refund_total_cents ?? 0) > 0 ? (
                    <div className="admin-order-money-row__item admin-order-money-row__refunded">
                      <span>Refunded</span>
                      <strong>{formatCents(order.refund_total_cents)}</strong>
                    </div>
                  ) : null}
                </div>
                {order.provider_payment_intent_id ? (
                  <div className="detail-meta-item" style={{ marginTop: 10 }}>
                    <span>Payment Intent</span>
                    <strong>
                      <CopyValue value={order.provider_payment_intent_id} />
                    </strong>
                  </div>
                ) : null}
              </details>
            </div>

            {/* ── Section 3: Fulfillment ──────────────────────── */}
            <div className="admin-order-section">
              <p className="admin-order-section-title">Fulfillment</p>

              <div className="admin-order-stage-track">
                {STAGE_ORDER.map((stage, idx) => {
                  const isDone = idx < currentStageIdx;
                  const isActive = idx === currentStageIdx;
                  let pillClass = `admin-order-stage-pill admin-order-stage-pill--${stage}`;
                  if (isDone) pillClass += " admin-order-stage-pill--done";
                  if (isActive) pillClass += " admin-order-stage-pill--active";
                  return (
                    <span key={stage} className={pillClass}>
                      {isDone ? "✓ " : ""}
                      {humanizeText(stage)}
                    </span>
                  );
                })}
              </div>

              <div className="admin-order-stage-panel">
                <p className="admin-order-recommendation">
                  <strong>Current:</strong>{" "}
                  {humanizeText(order.fulfillment_stage)}
                  <br />
                  <strong>Order Date:</strong> {formatDate(order.create_time)}
                  <br />
                  <strong>Last Update:</strong>{" "}
                  {formatDate(
                    order.fulfillment_update_time ?? order.update_time,
                  )}
                </p>
                <div className="admin-order-stage-controls">
                  <select
                    value={selectedStage}
                    onChange={(e) => {
                      setSelectedStage(e.target.value as FulfillmentStage);
                      setConfirmAdvance(false);
                    }}
                  >
                    {STAGE_ORDER.map((stage) => (
                      <option
                        key={stage}
                        value={stage}
                        disabled={!allowedTargets.has(stage)}
                      >
                        {humanizeText(stage)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      if (confirmAdvance) stageMutation.mutate(selectedStage);
                      else setConfirmAdvance(true);
                    }}
                    disabled={stageMutation.isPending || isTerminalStage}
                  >
                    {confirmAdvance
                      ? stageMutation.isPending
                        ? "Updating…"
                        : `Confirm → ${humanizeText(selectedStage)}`
                      : "Update"}
                  </button>
                  {confirmAdvance ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setConfirmAdvance(false)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
                {confirmAdvance ? (
                  <p
                    className="admin-order-confirm-note"
                    style={{ marginTop: 10 }}
                  >
                    This will move the order from{" "}
                    <strong>
                      {humanizeText(order.fulfillment_stage ?? "pending")}
                    </strong>{" "}
                    to <strong>{humanizeText(selectedStage)}</strong>.
                  </p>
                ) : null}

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", marginBottom: 8 }}>
                    <span style={{ display: "block", marginBottom: 6 }}>
                      Stage Note (optional)
                    </span>
                    <textarea
                      value={stageNote}
                      onChange={(event) => setStageNote(event.target.value)}
                      maxLength={2000}
                      placeholder="Add context for this stage transition"
                      rows={3}
                      style={{ width: "100%" }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", marginBottom: 6 }}>
                      Stage Metadata JSON (optional)
                    </span>
                    <textarea
                      value={stageMetadataText}
                      onChange={(event) =>
                        setStageMetadataText(event.target.value)
                      }
                      placeholder='{"source":"admin_ui"}'
                      rows={3}
                      style={{ width: "100%", fontFamily: "monospace" }}
                    />
                  </label>
                </div>

                {isTerminalStage ? (
                  <p
                    className="admin-order-confirm-note"
                    style={{ marginTop: 10 }}
                  >
                    This order is in a terminal stage and cannot be updated.
                  </p>
                ) : null}
              </div>

              <div
                className="admin-order-stage-panel"
                style={{ marginTop: 12 }}
              >
                <p className="admin-order-section-title">
                  Fulfillment Timeline
                </p>
                {fulfillmentNotes.length === 0 ? (
                  <p className="admin-order-empty">
                    No fulfillment notes recorded yet.
                  </p>
                ) : (
                  <div className="admin-order-item-summary">
                    {fulfillmentNotes.map((note: AdminOrderFulfillmentNote) => (
                      <div key={note.id} style={{ marginBottom: 10 }}>
                        <strong>
                          {humanizeText(note.from_stage ?? "-")} →{" "}
                          {humanizeText(note.to_stage)}
                        </strong>
                        <span>At: {formatDate(note.create_time)}</span>
                        <span>Actor: {note.actor_user_id ?? "System"}</span>
                        {note.note ? <span>Note: {note.note}</span> : null}
                        {note.metadata &&
                        Object.keys(note.metadata).length > 0 ? (
                          <details>
                            <summary>Metadata</summary>
                            <pre>{safeJsonStringify(note.metadata)}</pre>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 4: What Was Ordered ─────────────────── */}
            <div className="admin-order-section">
              <p className="admin-order-section-title">What Was Ordered</p>

              {/* Mint card (if mint order) */}
              {order.order_type === "mint" && resolvedMintCardId ? (
                <div style={{ marginBottom: 14 }}>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--ui-muted)",
                      marginBottom: 6,
                    }}
                  >
                    Mint Card
                  </p>
                  <div className="admin-order-card-chip-wrap">
                    <span className="admin-order-chip admin-order-chip--mint">
                      Mint
                    </span>
                    <CopyValue value={resolvedMintCardId} />
                    <Link
                      className="btn-secondary btn-xs"
                      to={`/app/admin/users/${order.user_id}/cards`}
                    >
                      View Card
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Cards from order.metadata.cards */}
              {metadataCards.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    Cards in Order
                  </p>
                  <div className="admin-table-wrap">
                    <table className="admin-metadata-cards-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Title</th>
                          <th>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metadataCards.map((card, idx) => {
                          const id =
                            toLabel(card.id) ??
                            toLabel(card.cardId) ??
                            toLabel(card.card_id) ??
                            `card-${idx}`;
                          const title =
                            toLabel(card.title) ?? toLabel(card.name) ?? "-";
                          const qty = toQty(card.quantity ?? card.qty ?? 1);
                          return (
                            <tr key={id}>
                              <td>
                                <code style={{ fontSize: "0.8rem" }}>{id}</code>
                              </td>
                              <td>{title}</td>
                              <td>{qty}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Order items table */}
              {order.items && order.items.length > 0 ? (
                <div className="admin-order-items-section">
                  <p
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    Line Items
                  </p>
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-order-items-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item</th>
                          <th>Pricing</th>
                          <th>Includes</th>
                          <th>Raw</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => {
                          const included = extractIncludedEntries(item);
                          return (
                            <tr key={item.id ?? idx}>
                              <td>{idx + 1}</td>
                              <td>
                                <div className="admin-order-item-summary">
                                  <strong>{getItemTitle(item)}</strong>
                                  <span>
                                    Type: {humanizeText(item.item_type)}
                                  </span>
                                  <span>Qty: {item.quantity ?? 1}</span>
                                </div>
                              </td>
                              <td>
                                <div className="admin-order-item-summary">
                                  <span>
                                    Unit: {formatCents(item.unit_price_cents)}
                                  </span>
                                  <span>
                                    Sub: {formatCents(item.line_subtotal_cents)}
                                  </span>
                                  <span>
                                    Tax: {formatCents(item.line_tax_cents)}
                                  </span>
                                  <strong>
                                    Total: {formatCents(item.line_total_cents)}
                                  </strong>
                                </div>
                              </td>
                              <td>
                                {included.length > 0 ? (
                                  <div className="admin-order-item-summary">
                                    {included.map((entry) => (
                                      <span
                                        key={`${entry.label}-${entry.quantity}`}
                                      >
                                        {entry.label} ×{entry.quantity}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      color: "var(--ui-muted)",
                                      fontSize: "0.82rem",
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                <details>
                                  <summary>View</summary>
                                  <pre>{safeJsonStringify(item)}</pre>
                                </details>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="admin-order-empty">
                  No line items for this order.
                </p>
              )}

              {/* Related cards from API */}
              {relatedCards.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    Related Cards (API)
                  </p>
                  <div className="admin-order-card-chip-list">
                    {relatedCards.map((entry) => {
                      const card = (entry.card ?? {}) as Record<
                        string,
                        unknown
                      >;
                      const cardData =
                        (card.data as Record<string, unknown>) ?? {};
                      const title =
                        (typeof cardData.title === "string" &&
                          cardData.title) ||
                        (typeof card.title === "string" && card.title) ||
                        "Untitled card";
                      return (
                        <div
                          key={entry.cardID}
                          className="admin-order-card-chip-wrap"
                        >
                          <CopyValue value={entry.cardID} />
                          <span
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--ui-muted)",
                            }}
                          >
                            {title}
                          </span>
                          {entry.artifacts.preview ? (
                            <a
                              className="btn-secondary btn-xs"
                              href={entry.artifacts.preview}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Preview
                            </a>
                          ) : null}
                          {entry.artifacts.proof ? (
                            <a
                              className="btn-secondary btn-xs"
                              href={entry.artifacts.proof}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Proof
                            </a>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Section 5: Raw Data ──────────────────────────── */}
            <div className="admin-order-section">
              <p className="admin-order-section-title">Raw Data</p>
              <div className="detail-meta-grid" style={{ marginBottom: 14 }}>
                <div className="detail-meta-item">
                  <span>Order Type</span>
                  <strong>{rawSummary.orderType}</strong>
                </div>
                <div className="detail-meta-item">
                  <span>Items</span>
                  <strong>{rawSummary.itemCount}</strong>
                </div>
                <div className="detail-meta-item">
                  <span>Related Cards</span>
                  <strong>{rawSummary.relatedCardCount}</strong>
                </div>
                <div className="detail-meta-item">
                  <span>Metadata Cards</span>
                  <strong>{rawSummary.metadataCardCount}</strong>
                </div>
                <div className="detail-meta-item">
                  <span>Response Keys</span>
                  <strong>
                    {rawSummary.responseKeys.length > 0
                      ? rawSummary.responseKeys.join(", ")
                      : "-"}
                  </strong>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleLogDebugPayload}
                >
                  Log Debug Payload
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCopyDebugPayload}
                >
                  Copy Debug Payload
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadDebugPayload}
                >
                  Download Debug JSON
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {/* ── Refund modal ──────────────────────────────────────── */}
      {refundOpen ? (
        <div
          className="admin-refund-modal-overlay"
          onClick={() => setRefundOpen(false)}
        >
          <div
            className="admin-refund-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Issue Refund</h3>

            <div className="admin-refund-warning">
              ⚠ This action is permanent and cannot be undone.
            </div>

            <label htmlFor="refund-cents">Refund amount (cents)</label>
            <input
              id="refund-cents"
              type="number"
              min={1}
              max={order?.total_cents ?? undefined}
              value={refundCents}
              onChange={(e) => setRefundCents(Number(e.target.value))}
            />

            <label htmlFor="refund-reason">Reason</label>
            <textarea
              id="refund-reason"
              placeholder="Describe the reason for this refund…"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            />

            {refundMutation.isError ? (
              <p className="admin-refund-warning" style={{ marginBottom: 14 }}>
                Refund failed. Please check the amount and try again.
              </p>
            ) : null}

            <div className="admin-refund-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRefundOpen(false)}
                disabled={refundMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={
                  refundMutation.isPending ||
                  refundCents <= 0 ||
                  refundReason.trim().length === 0
                }
                onClick={() => refundMutation.mutate()}
              >
                {refundMutation.isPending
                  ? "Processing…"
                  : `Refund ${formatCents(refundCents)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
