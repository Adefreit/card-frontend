import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  type AdminFulfillmentStage,
  type AdminOrderFulfillmentNote,
  type AdminOrderItem,
  type AdminOrderRecord,
  addAdminOrderFulfillmentNote,
  getAdminOrder,
  refundAdminOrder,
  updateAdminOrderFulfillmentStage,
} from "../api";
import StageAdvanceModal from "./StageAdvanceModal";

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

function shortId(value?: string | null) {
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function safeJsonStringify(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(
      value,
      (_key, currentValue) => {
        if (typeof currentValue === "bigint") return currentValue.toString();

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
          if (seen.has(currentValue)) return "[Circular]";
          seen.add(currentValue);
        }

        return currentValue;
      },
      2,
    );
  } catch (error) {
    return JSON.stringify(
      {
        error: "Unable to serialize payload safely.",
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
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    return value.length > 2000
      ? `${value.slice(0, 2000)}... [truncated ${value.length - 2000} chars]`
      : value;
  }
  if (typeof value !== "object") return value;

  if (seen.has(value)) return "[Circular]";
  if (depth >= 6) return "[Max depth reached]";

  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, 60)
      .map((entry) => sanitizeForDisplay(entry, depth + 1, seen));

    if (value.length > 60) {
      sanitized.push(`[${value.length - 60} more items truncated]`);
    }

    return sanitized;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  const limitedEntries = entries.slice(0, 80);
  const result: Record<string, unknown> = {};

  for (const [key, entryValue] of limitedEntries) {
    result[key] = sanitizeForDisplay(entryValue, depth + 1, seen);
  }

  if (entries.length > 80) {
    result.__truncated__ = `${entries.length - 80} more keys omitted`;
  }

  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 1;
}

function normalizeMatchKey(value?: string | null) {
  if (!value) return "";
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseApiError(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { response?: string; message?: string; error?: string }
      | undefined;

    const apiMessage = data?.message ?? data?.response ?? data?.error;
    if (apiMessage && apiMessage.trim().length > 0) return apiMessage;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
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
        toLabel(entryRecord.card_id) ||
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
    toLabel(itemRecord.title) ||
    toLabel(metadata?.title) ||
    toLabel(metadata?.name) ||
    toLabel(options?.title) ||
    toLabel(options?.name) ||
    toLabel(itemRecord.product_id) ||
    toLabel(itemRecord.item_type) ||
    "Order Item"
  );
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const locationOrder = (location.state as { order?: AdminOrderRecord } | null)
    ?.order;

  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [orderFallback, setOrderFallback] = useState<AdminOrderRecord | null>(
    locationOrder ?? null,
  );
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageModalTarget, setStageModalTarget] =
    useState<FulfillmentStage | null>(null);
  const [fulfillmentNoteDraft, setFulfillmentNoteDraft] = useState("");

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundCents, setRefundCents] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");

  const orderQuery = useQuery({
    queryKey: ["admin", "order", orderId],
    queryFn: () => getAdminOrder(orderId as string),
    enabled: Boolean(orderId),
    retry: 1,
  });

  useEffect(() => {
    if (locationOrder) setOrderFallback(locationOrder);
  }, [locationOrder]);

  const order = orderQuery.data?.order ?? orderFallback;
  const relatedUser = orderQuery.data?.user ?? null;
  const relatedCards = orderQuery.data?.cards ?? [];
  const fulfillmentNotes = orderQuery.data?.fulfillmentNotes ?? [];

  useEffect(() => {
    if (!order) return;
    const remaining =
      (order.total_cents ?? 0) - (order.refund_total_cents ?? 0);
    setRefundCents(Math.max(0, remaining));
  }, [order]);

  const stageMutation = useMutation({
    mutationFn: ({
      stage,
      note,
      metadata,
    }: {
      stage: FulfillmentStage;
      note: string;
      metadata: Record<string, unknown>;
    }) =>
      updateAdminOrderFulfillmentStage(
        orderId as string,
        stage,
        note || undefined,
        Object.keys(metadata).length > 0 ? metadata : undefined,
      ),
    onSuccess: async (_data, variables) => {
      setMutationMessage("Order fulfillment stage updated successfully.");
      setStageModalOpen(false);
      setOrderFallback((prev) =>
        prev
          ? {
              ...prev,
              fulfillment_stage: variables.stage,
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
      setMutationMessage(parseApiError(error, "Failed to update order stage."));
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) =>
      addAdminOrderFulfillmentNote(orderId as string, note),
    onSuccess: async () => {
      setMutationMessage("Fulfillment note added.");
      setFulfillmentNoteDraft("");
      await queryClient.invalidateQueries({
        queryKey: ["admin", "order", orderId],
      });
    },
    onError: (error) => {
      setMutationMessage(
        parseApiError(error, "Failed to add fulfillment note."),
      );
    },
  });

  const refundMutation = useMutation({
    mutationFn: () =>
      refundAdminOrder(orderId as string, refundCents, refundReason.trim()),
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
    onError: (error) => {
      setMutationMessage(
        parseApiError(
          error,
          "Refund failed. Please check the amount and try again.",
        ),
      );
    },
  });

  if (!orderId) return <Navigate to="/app/admin/orders" replace />;

  const currentStage = (order?.fulfillment_stage ??
    "pending") as FulfillmentStage;
  const isTerminalStage =
    currentStage === "complete" || currentStage === "cancelled";
  const isDigitalOrder =
    order?.order_type === "mint" || order?.order_type === "subscription";

  const allowedTargets = (() => {
    if (!order?.fulfillment_stage) return new Set<FulfillmentStage>();

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
      transitions[order.fulfillment_stage] ?? [],
    );
  })();

  const canRefund =
    order?.status === "paid" || order?.status === "partially_refunded";
  const remainingRefundable = Math.max(
    0,
    (order?.total_cents ?? 0) - (order?.refund_total_cents ?? 0),
  );

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
        : groupedCardsFromItems.length > 0
          ? "Card Order"
          : humanizeText(order?.order_type);

  const relatedProofMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const card of relatedCards) {
      const proof = card.artifacts?.proof;
      if (!proof) continue;

      map.set(normalizeMatchKey(card.cardID), proof);

      const record = asRecord(card.card);
      const dataRecord = asRecord(record?.data);
      const title = toLabel(dataRecord?.title) ?? toLabel(record?.title);
      if (title) {
        map.set(normalizeMatchKey(title), proof);
      }
    }

    return map;
  }, [relatedCards]);

  const relatedPreviewMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const card of relatedCards) {
      const preview = card.artifacts?.preview;
      if (!preview) continue;

      map.set(normalizeMatchKey(card.cardID), preview);

      const record = asRecord(card.card);
      const dataRecord = asRecord(record?.data);
      const title = toLabel(dataRecord?.title) ?? toLabel(record?.title);
      if (title) {
        map.set(normalizeMatchKey(title), preview);
      }
    }

    return map;
  }, [relatedCards]);

  const rawPayloadText = useMemo(
    () => safeJsonStringify(sanitizeForDisplay(orderQuery.data)),
    [orderQuery.data],
  );

  function handleCopyDebugPayload() {
    void navigator.clipboard
      .writeText(rawPayloadText)
      .then(() => setMutationMessage("Raw data copied to clipboard."))
      .catch(() => setMutationMessage("Unable to copy raw data."));
  }

  function handleDownloadDebugPayload() {
    const blob = new Blob([rawPayloadText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-order-${orderId}-raw.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMutationMessage("Raw data downloaded.");
  }

  const railToneClass = `admin-order-rail-status admin-order-rail-status--${currentStage}`;

  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Order Detail</h1>
          <p className="content-hero-copy">
            Fast operational view for fulfillment, payment, and card proofs.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/admin/orders">
          &lt;- Back to Orders
        </Link>
      </section>

      <section className="dash-panel admin-card">
        {mutationMessage ? (
          <p className="alert-success" style={{ marginBottom: 12 }}>
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
          <div className="admin-order-layout">
            <div className="admin-order-main" style={{ minWidth: 0 }}>
              <div className="admin-order-section">
                <p className="admin-order-section-title">Order Summary</p>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  <div className="detail-meta-item">
                    <span>Order ID</span>
                    <strong
                      style={{
                        fontSize: "0.78rem",
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                      }}
                    >
                      {order.id}
                    </strong>
                  </div>
                  <div className="detail-meta-item">
                    <span>Customer</span>
                    <strong>
                      {order.user_id ? (
                        <Link to={`/app/admin/users/${order.user_id}`}>
                          {relatedUser?.email ?? shortId(order.user_id)}
                        </Link>
                      ) : (
                        (relatedUser?.email ?? "-")
                      )}
                    </strong>
                  </div>
                  <div className="detail-meta-item">
                    <span>Ordered</span>
                    <strong>{summaryWhatWasOrdered}</strong>
                  </div>
                  <div className="detail-meta-item">
                    <span>Created</span>
                    <strong>{formatDate(order.create_time)}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-order-section">
                <p className="admin-order-section-title">What Was Ordered</p>

                {order.items && order.items.length > 0 ? (
                  <>
                    <div className="admin-table-wrap">
                      <table className="admin-table admin-order-items-grid-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Type</th>
                            <th>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => (
                            <tr key={item.id ?? `item-${idx}`}>
                              <td>{getItemTitle(item)}</td>
                              <td>{humanizeText(item.item_type)}</td>
                              <td>{item.quantity ?? 1}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {groupedCardsFromItems.length > 0 ? (
                      <div style={{ marginTop: 16 }}>
                        <p className="admin-order-subsection-title">
                          Cards &amp; Proofs
                        </p>
                        <div className="admin-table-wrap">
                          <table className="admin-table admin-order-items-grid-table">
                            <thead>
                              <tr>
                                <th>Card</th>
                                <th>Qty</th>
                                <th>Proof</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedCardsFromItems.map(
                                ([label, quantity]) => {
                                  const key = normalizeMatchKey(label);
                                  const proof =
                                    relatedProofMap.get(key) ?? null;
                                  const preview =
                                    relatedPreviewMap.get(key) ?? null;
                                  return (
                                    <tr key={label}>
                                      <td>
                                        <span className="admin-card-preview-wrap">
                                          {label}
                                          {preview ? (
                                            <img
                                              className="admin-card-preview-img"
                                              src={preview}
                                              alt={`${label} preview`}
                                              loading="lazy"
                                            />
                                          ) : null}
                                        </span>
                                      </td>
                                      <td>{quantity}</td>
                                      <td>
                                        {proof ? (
                                          <a
                                            className="btn-secondary btn-xs"
                                            href={proof}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                          >
                                            Download
                                          </a>
                                        ) : (
                                          <span>-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                },
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="admin-order-empty">
                    No line items for this order.
                  </p>
                )}
              </div>

              <div className="admin-order-section">
                <div className="admin-order-section-header">
                  <div className="admin-payment-title-row">
                    <p
                      className="admin-order-section-title"
                      style={{ margin: 0 }}
                    >
                      Payment Details
                    </p>
                    <span className="admin-payment-provider-chip">
                      {capitalize(order.payment_provider)}
                    </span>
                  </div>
                  <strong className="admin-order-payment-total">
                    {formatCents(order.total_cents)}{" "}
                    {(order.currency ?? "-").toUpperCase()}
                  </strong>
                </div>

                {order.provider_checkout_id ? (
                  <div className="admin-payment-info-row">
                    <span className="admin-payment-badge">
                      <span className="admin-payment-badge__label">
                        Checkout
                      </span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.68rem",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {order.provider_checkout_id}
                      </span>
                    </span>
                  </div>
                ) : null}

                <table className="admin-payment-money-table">
                  <tbody>
                    <tr>
                      <td>Subtotal</td>
                      <td>{formatCents(order.subtotal_cents)}</td>
                    </tr>
                    <tr>
                      <td>Tax</td>
                      <td>{formatCents(order.tax_cents)}</td>
                    </tr>
                    <tr>
                      <td>Shipping</td>
                      <td>{formatCents(order.shipping_cents)}</td>
                    </tr>
                    <tr className="admin-payment-money-table__total">
                      <td>Total</td>
                      <td>{formatCents(order.total_cents)}</td>
                    </tr>
                    {(order.refund_total_cents ?? 0) > 0 ? (
                      <tr className="admin-payment-money-table__refunded">
                        <td>Refunded</td>
                        <td>&#8722;{formatCents(order.refund_total_cents)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>

                {canRefund ? (
                  <div className="admin-order-payment-actions">
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => setRefundOpen(true)}
                    >
                      Issue Refund
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="admin-order-section">
                <div className="admin-order-section-header">
                  <p
                    className="admin-order-section-title"
                    style={{ margin: 0 }}
                  >
                    Raw Data
                  </p>
                  <div className="admin-order-section-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCopyDebugPayload}
                    >
                      Copy Raw JSON
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleDownloadDebugPayload}
                    >
                      Download Raw JSON
                    </button>
                  </div>
                </div>
                <details>
                  <summary className="admin-order-expand-summary">
                    Show raw payload
                  </summary>
                  <textarea
                    readOnly
                    value={rawPayloadText}
                    style={{
                      width: "100%",
                      marginTop: 10,
                      minHeight: 220,
                      maxHeight: 420,
                      resize: "vertical",
                      fontFamily: "monospace",
                      fontSize: "0.78rem",
                      lineHeight: 1.45,
                    }}
                  />
                </details>
              </div>
            </div>

            <aside className="admin-order-section admin-order-rail">
              <p
                className="admin-order-section-title"
                style={{ marginBottom: 8 }}
              >
                Fulfillment Status
              </p>

              <div className={railToneClass}>
                <div className="admin-order-rail-status__label">
                  Current status
                </div>
                <div className="admin-order-rail-status__value">
                  {humanizeText(currentStage)}
                </div>
                <div className="admin-order-rail-status__time">
                  Last update{" "}
                  {formatDate(
                    order.fulfillment_update_time ?? order.update_time,
                  )}
                </div>
              </div>

              <div
                className="admin-order-stage-controls"
                style={{ marginBottom: 10 }}
              >
                {!isTerminalStage && allowedTargets.size > 0 ? (
                  <div className="admin-stage-btn-row">
                    {[...allowedTargets].map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        className={`admin-stage-transition-btn${stage === "cancelled" ? " admin-stage-transition-btn--danger" : stage === "complete" ? " admin-stage-transition-btn--success" : ""}`}
                        onClick={() => {
                          setStageModalTarget(stage);
                          setStageModalOpen(true);
                        }}
                        disabled={stageMutation.isPending}
                      >
                        <span className="admin-stage-transition-btn__arrow">
                          →
                        </span>
                        {humanizeText(stage)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="admin-order-note-editor">
                <label>
                  <span>Add fulfillment note</span>
                  <textarea
                    value={fulfillmentNoteDraft}
                    onChange={(event) =>
                      setFulfillmentNoteDraft(event.target.value)
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Add a note without changing status"
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    addNoteMutation.isPending ||
                    fulfillmentNoteDraft.trim().length === 0 ||
                    !order
                  }
                  onClick={() =>
                    addNoteMutation.mutate(fulfillmentNoteDraft.trim())
                  }
                >
                  {addNoteMutation.isPending ? "Saving..." : "Add Note"}
                </button>
              </div>

              <div
                className="admin-order-stage-panel"
                style={{ marginTop: 12 }}
              >
                <p className="admin-order-section-title">Timeline</p>
                {fulfillmentNotes.length === 0 ? (
                  <p className="admin-order-empty">
                    No fulfillment notes recorded yet.
                  </p>
                ) : (
                  <div className="admin-order-timeline">
                    {fulfillmentNotes
                      .slice(0, 8)
                      .map((note: AdminOrderFulfillmentNote) => {
                        const metaEntries = Object.entries(
                          note.metadata ?? {},
                        ).filter(([k]) => k !== "source");
                        const sourceValue = (
                          note.metadata as Record<string, unknown>
                        )?.source;
                        return (
                          <div key={note.id} className="admin-timeline-entry">
                            <span className="admin-timeline-entry__date">
                              {formatDate(note.create_time)}
                              {sourceValue ? (
                                <span className="admin-timeline-entry__source">
                                  {" "}
                                  via {String(sourceValue)}
                                </span>
                              ) : null}
                            </span>
                            {note.from_stage !== note.to_stage ? (
                              <p className="admin-timeline-entry__stage">
                                <span
                                  className={`admin-stage-badge admin-stage-badge--${note.from_stage ?? "pending"}`}
                                >
                                  {humanizeText(note.from_stage ?? "pending")}
                                </span>
                                {" → "}
                                <span
                                  className={`admin-stage-badge admin-stage-badge--${note.to_stage}`}
                                >
                                  {humanizeText(note.to_stage)}
                                </span>
                              </p>
                            ) : null}
                            {note.note ? (
                              <p className="admin-timeline-entry__note">
                                {note.note}
                              </p>
                            ) : null}
                            {metaEntries.length > 0 ? (
                              <details className="admin-timeline-meta-details">
                                <summary className="admin-timeline-meta-summary">
                                  {metaEntries.length}{" "}
                                  {metaEntries.length === 1
                                    ? "metadata key"
                                    : "metadata keys"}
                                </summary>
                                <table className="admin-timeline-meta-table">
                                  <tbody>
                                    {metaEntries.map(([k, v]) => (
                                      <tr key={k}>
                                        <td className="admin-timeline-meta-table__key">
                                          {k}
                                        </td>
                                        <td>{String(v)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {isTerminalStage ? (
                <p
                  className="admin-order-confirm-note"
                  style={{ marginTop: 8 }}
                >
                  This order is in a terminal stage and cannot be updated.
                </p>
              ) : null}
            </aside>
          </div>
        ) : null}
      </section>

      {refundOpen ? (
        <div
          className="admin-refund-modal-overlay"
          onClick={() => setRefundOpen(false)}
        >
          <div
            className="admin-refund-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Issue Refund</h3>

            <div className="admin-refund-warning">
              This action is permanent and cannot be undone.
            </div>

            <label htmlFor="refund-cents">Refund amount (cents)</label>
            <input
              id="refund-cents"
              type="number"
              min={1}
              max={remainingRefundable || undefined}
              value={refundCents}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (Number.isNaN(nextValue)) {
                  setRefundCents(0);
                  return;
                }
                setRefundCents(Math.max(0, Math.floor(nextValue)));
              }}
            />

            <label htmlFor="refund-reason">Reason</label>
            <textarea
              id="refund-reason"
              placeholder="Describe the reason for this refund..."
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              maxLength={2000}
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
                  refundCents > remainingRefundable ||
                  refundReason.trim().length === 0
                }
                onClick={() => refundMutation.mutate()}
              >
                {refundMutation.isPending
                  ? "Processing..."
                  : `Refund ${formatCents(refundCents)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stageModalOpen && stageModalTarget ? (
        <StageAdvanceModal
          targetStage={stageModalTarget}
          isPending={stageMutation.isPending}
          onClose={() => {
            if (!stageMutation.isPending) setStageModalOpen(false);
          }}
          onConfirm={(note, metadata) => {
            stageMutation.mutate({ stage: stageModalTarget, note, metadata });
          }}
        />
      ) : null}
    </div>
  );
}
