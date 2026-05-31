import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AdminFulfillmentStage,
  type AdminOrderRecord,
  addAdminOrderFulfillmentNote,
  getAdminCardProof,
  getAdminOrder,
  refundAdminOrder,
  updateAdminOrderFulfillmentStage,
} from "../api";
import StageAdvanceModal from "./StageAdvanceModal";
import {
  extractIncludedEntries,
  humanizeText,
  parseApiError,
  safeJsonStringify,
  sanitizeForDisplay,
} from "../utils";
import {
  OrderSummarySection,
  OrderItemsTable,
  CardsAndProofsSection,
  PaymentDetailsSection,
  RawDataSection,
  FulfillmentStatusPanel,
  FulfillmentStageControls,
  FulfillmentNoteEditor,
  FulfillmentTimeline,
  RefundModal,
} from "../components/order-detail";

type FulfillmentStage = AdminFulfillmentStage;

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

  const [fetchedCardId, setFetchedCardId] = useState<string | null>(null);
  const [fetchedProofUrl, setFetchedProofUrl] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ["admin", "order", orderId],
    queryFn: () => getAdminOrder(orderId as string),
    enabled: Boolean(orderId),
    retry: 1,
  });

  const order = orderQuery.data?.order ?? orderFallback;
  const relatedUser = orderQuery.data?.user ?? null;
  const fulfillmentNotes = orderQuery.data?.fulfillmentNotes ?? [];

  // Update fallback order when location order changes
  useEffect(() => {
    if (locationOrder) setOrderFallback(locationOrder);
  }, [locationOrder]);

  // Calculate refund cents from order
  const calculatedRefundCents = useMemo(() => {
    if (!order) return 0;
    const remaining =
      (order.total_cents ?? 0) - (order.refund_total_cents ?? 0);
    return Math.max(0, remaining);
  }, [order]);

  useEffect(() => {
    setRefundCents(calculatedRefundCents);
  }, [calculatedRefundCents]);

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

  const downloadProofMutation = useMutation({
    mutationFn: ({ cardId }: { cardId: string }) => getAdminCardProof(cardId),
    onSuccess: (proofUrl: string | null, variables) => {
      if (proofUrl) {
        setFetchedCardId(variables.cardId);
        setFetchedProofUrl(proofUrl);
      } else {
        setMutationMessage("No proof URL available for this card.");
      }
    },
    onError: () => {
      setMutationMessage("Failed to fetch proof. Please try again.");
    },
  });

  const rawPayloadText = useMemo(
    () => safeJsonStringify(sanitizeForDisplay(orderQuery.data)),
    [orderQuery.data],
  );

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
              <OrderSummarySection
                order={order}
                relatedUser={relatedUser}
                summaryWhatWasOrdered={summaryWhatWasOrdered}
              />

              {order.items && order.items.length > 0 ? (
                <div className="admin-order-section">
                  <p className="admin-order-section-title">What Was Ordered</p>
                  <OrderItemsTable items={order.items} />
                  {groupedCardsFromItems.length > 0 ? (
                    <CardsAndProofsSection
                      groupedCards={groupedCardsFromItems}
                      downloadProofMutation={downloadProofMutation}
                      fetchedCardId={fetchedCardId}
                      fetchedProofUrl={fetchedProofUrl}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="admin-order-section">
                  <p className="admin-order-empty">
                    No line items for this order.
                  </p>
                </div>
              )}

              <PaymentDetailsSection
                order={order}
                canRefund={canRefund}
                onRefundClick={() => setRefundOpen(true)}
              />

              <RawDataSection
                rawPayloadText={rawPayloadText}
                onCopyClick={handleCopyDebugPayload}
                onDownloadClick={handleDownloadDebugPayload}
              />
            </div>

            <aside className="admin-order-section admin-order-rail">
              <FulfillmentStatusPanel
                order={order}
                currentStage={currentStage}
              />

              <FulfillmentStageControls
                allowedTargets={allowedTargets}
                isTerminalStage={isTerminalStage}
                stageMutation={stageMutation}
                onStageClick={(stage) => {
                  setStageModalTarget(stage);
                  setStageModalOpen(true);
                }}
              />

              <FulfillmentNoteEditor
                draftText={fulfillmentNoteDraft}
                onDraftChange={setFulfillmentNoteDraft}
                addNoteMutation={addNoteMutation}
                isOrderLoaded={!!order}
              />

              <FulfillmentTimeline notes={fulfillmentNotes} />

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

      <RefundModal
        isOpen={refundOpen}
        refundCents={refundCents}
        refundReason={refundReason}
        remainingRefundable={remainingRefundable}
        refundMutation={refundMutation}
        onClose={() => setRefundOpen(false)}
        onRefundCentsChange={setRefundCents}
        onRefundReasonChange={setRefundReason}
        onConfirm={() => refundMutation.mutate()}
      />

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
