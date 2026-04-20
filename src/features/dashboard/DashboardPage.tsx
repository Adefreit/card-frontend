import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import {
  getCard,
  getCards,
  renderCardProof,
  renderCardProofPrinterFriendly,
} from "../cards/api";
import MintCardModal from "../cards/components/MintCardModal";
import { apiClient } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  type CardPackProductId,
  createIdempotencyKey,
  createTransaction,
  getCheckoutRedirectUrl,
  getPricing,
  getTransactions,
  resumeTransaction,
  type TransactionRecord,
  type StripePriceSummary,
  type SubscriptionTypePricing,
} from "../transactions/api";
import PlanComparisonTable from "../subscription/components/PlanComparisonTable";

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #075985 100%)",
  "linear-gradient(135deg, #14532d 0%, #15803d 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)",
  "linear-gradient(135deg, #581c87 0%, #7e22ce 100%)",
] as const;

const CARD_TINT_BORDERS = [
  "rgba(55, 48, 163, 0.34)",
  "rgba(7, 89, 133, 0.34)",
  "rgba(21, 128, 61, 0.34)",
  "rgba(194, 65, 12, 0.34)",
  "rgba(126, 34, 206, 0.34)",
] as const;

function isMinted(minted?: boolean): boolean {
  return Boolean(minted);
}

function hasActiveSubscription(accountSubscriptionUntil?: string | null) {
  if (!accountSubscriptionUntil) {
    return false;
  }

  return new Date(accountSubscriptionUntil) > new Date();
}

function getCatalogProductId(quantity: number): string {
  switch (quantity) {
    case 50:
      return "card_pack_50";
    case 100:
      return "card_pack_100";
    case 500:
      return "card_pack_500";
    case 1000:
      return "card_pack_1000";
    default:
      throw new Error("Unsupported pack quantity selected.");
  }
}

function getPurchaseTransactionErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    return "Unable to start checkout right now. Please try again.";
  }

  if (error.response?.status !== 400) {
    return "Unable to start checkout right now. Please try again.";
  }

  const data = error.response.data;
  const responseMessage =
    typeof data === "object" && data !== null && "response" in data
      ? (data.response as string | undefined)
      : undefined;
  const detailText = (responseMessage ?? "").toLowerCase();

  if (
    detailText.includes("itemtype") ||
    detailText.includes("productid") ||
    detailText.includes("quantity")
  ) {
    return "Checkout validation failed. Verify product type, product ID, and quantity.";
  }

  if (detailText.includes("unsupported") || detailText.includes("product")) {
    return "This card pack is not available yet. Please choose a different pack size.";
  }

  if (detailText.includes("mismatch")) {
    return "Selected product information did not pass validation. Please try again.";
  }

  return (
    responseMessage || "Unable to start checkout right now. Please try again."
  );
}

function formatStripePrice(price: {
  unitAmountCents: number;
  currency: string;
}) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.unitAmountCents / 100);
}

function formatTransactionDate(value?: string) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return parsed.toLocaleString();
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

function formatOrderAmount(order: TransactionRecord) {
  const source = asRecord(order) ?? {};
  const cents = getNumberField(source, [
    "total_cents",
    "totalCents",
    "amount_total",
    "amountTotal",
    "amount",
  ]);

  if (typeof cents !== "number") {
    return "Amount unavailable";
  }

  const currency = getStringField(source, ["currency", "currency_code"]);
  const safeCurrency = (currency ?? "usd").toUpperCase();

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: safeCurrency,
  }).format(cents / 100);
}

function formatOrderStatus(status?: string) {
  if (!status) {
    return "Unknown";
  }

  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderDescription(order: TransactionRecord) {
  const source = asRecord(order) ?? {};
  const items = Array.isArray(source.items) ? source.items : [];

  for (const entry of items) {
    const item = asRecord(entry);
    if (!item) {
      continue;
    }

    const itemType = getStringField(item, ["item_type", "itemType"]);
    if (itemType !== "card_pack") {
      continue;
    }

    const productId = getStringField(item, ["product_id", "productId"]);
    if (productId) {
      const match = productId.match(/card_pack_(\d+)/i);
      if (match) {
        const size = Number(match[1]);
        return `Card Pack (${size.toLocaleString()} cards)`;
      }
    }

    return "Card Pack Order";
  }

  return "Purchase Item Order";
}

function PlanModal({
  onClose,
  plans,
  selectedPlanId,
  onSelectPlan,
  selectedInterval,
  onSelectInterval,
  onStartSubscription,
  onResumeSubscription,
  isCancellationScheduled,
  isResumePending,
  isStartPending,
  isSubscribed,
  mintPrice,
}: {
  onClose: () => void;
  plans: SubscriptionTypePricing[];
  selectedPlanId: string;
  onSelectPlan: (id: string) => void;
  selectedInterval: "month" | "year";
  onSelectInterval: (interval: "month" | "year") => void;
  onStartSubscription: () => void;
  onResumeSubscription: () => void;
  isCancellationScheduled: boolean;
  isResumePending: boolean;
  isStartPending: boolean;
  isSubscribed: boolean;
  mintPrice?: StripePriceSummary | null;
}) {
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Free vs. Founder Subscription</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">
          Pick a model that fits your journey today.
        </p>
        {isCancellationScheduled ? (
          <p className="alert-success" style={{ margin: "8px 22px 0" }}>
            Cancellation is scheduled. Resume to keep your current subscription
            active and avoid duplicate billing.
          </p>
        ) : null}
        <PlanComparisonTable
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={onSelectPlan}
          selectedInterval={selectedInterval}
          onSelectInterval={onSelectInterval}
          onStartSubscription={onStartSubscription}
          isStartPending={isStartPending}
          isSubscribed={isSubscribed}
          mintPrice={mintPrice}
        />
        <div className="qr-modal-footer">
          {isCancellationScheduled ? (
            <button
              type="button"
              className="btn-primary"
              onClick={onResumeSubscription}
              disabled={isResumePending}
            >
              {isResumePending ? "Resuming..." : "Resume Subscription"}
            </button>
          ) : null}
          {!selectedPlan ? (
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              No subscription plans are currently available.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

async function fetchQrBlobUrl(cardId: string): Promise<string> {
  const { data } = await apiClient.get<Blob>(`/v1/cards/render/qr/${cardId}`, {
    params: { format: "png", dpi: 300 },
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}

interface QrModalProps {
  cardId: string;
  cardTitle: string;
  onClose: () => void;
}

function QrModal({ cardId, cardTitle, onClose }: QrModalProps) {
  const {
    data: blobUrl,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["qr", cardId],
    queryFn: () => fetchQrBlobUrl(cardId),
    staleTime: Infinity,
  });

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>QR Code</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">
          <b>{cardTitle}</b>
        </p>
        <p className="qr-modal-subtitle">
          This QR code can be scanned to access the user hub. Feel free to
          download it and use it however you would like.
        </p>
        <div className="qr-modal-body">
          {isLoading && <p className="dash-loading">Summoning QR code…</p>}
          {isError && (
            <p className="alert-error">Failed to load QR code. Try again.</p>
          )}
          {blobUrl && (
            <img
              className="qr-image"
              src={blobUrl}
              alt={`QR code for ${cardTitle}`}
            />
          )}
        </div>
        {blobUrl && (
          <div className="qr-modal-footer qr-modal-footer--actions">
            <Link className="btn-secondary" to={`/cardviewer/${cardId}`}>
              Open Card Viewer
            </Link>
            <a
              className="btn-primary"
              href={blobUrl}
              download={`${cardTitle.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
            >
              ⬇ Download (PNG)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProofModalProps {
  cardId: string;
  cardTitle: string;
  isMintedCard: boolean;
  selectedQuantity: number;
  packPrices?: Record<CardPackProductId, StripePriceSummary> | null;
  onSelectQuantity: (quantity: number) => void;
  onOrderConfirm: () => void;
  onMintRequest: () => void;
  isMintPending: boolean;
  isOrderPending: boolean;
  orderErrorMessage?: string | null;
  onClose: () => void;
}

function getDownloadFileName(cardTitle: string, suffix: string) {
  return `${cardTitle.replace(/\s+/g, "-").toLowerCase()}-${suffix}.png`;
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function getPdfDownloadFileName(cardTitle: string) {
  return `${cardTitle.replace(/\s+/g, "-").toLowerCase()}-printer-friendly.pdf`;
}

function ProofModal({
  cardId,
  cardTitle,
  isMintedCard,
  selectedQuantity,
  packPrices,
  onSelectQuantity,
  onOrderConfirm,
  onMintRequest,
  isMintPending,
  isOrderPending,
  orderErrorMessage,
  onClose,
}: ProofModalProps) {
  const quantities = [50, 100, 500, 1000] as const;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const {
    data: card,
    isLoading: isCardLoading,
    isError: isCardError,
  } = useQuery({
    queryKey: ["card-proof-source", cardId],
    queryFn: () => getCard(cardId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const {
    data: proofBlob,
    isLoading: isProofLoading,
    isError: isProofError,
  } = useQuery({
    queryKey: ["card-proof", cardId],
    queryFn: () => renderCardProof(cardId),
    enabled: Boolean(card) && isMintedCard,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const printerFriendlyMutation = useMutation({
    mutationFn: () => renderCardProofPrinterFriendly(cardId),
    onSuccess: (blob) => {
      downloadBlobFile(blob, getPdfDownloadFileName(cardTitle));
    },
  });

  const fallbackPreviewUrl = isMintedCard
    ? (card?.last_proof ?? card?.last_render ?? null)
    : (card?.last_render ?? card?.last_proof ?? null);

  useEffect(() => {
    if (!isMintedCard) {
      setBlobUrl(fallbackPreviewUrl);
      return;
    }

    if (proofBlob) {
      const nextBlobUrl = URL.createObjectURL(proofBlob);
      setBlobUrl(nextBlobUrl);

      return () => {
        URL.revokeObjectURL(nextBlobUrl);
      };
    }

    setBlobUrl(fallbackPreviewUrl);
  }, [fallbackPreviewUrl, isMintedCard, proofBlob]);

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div
        className="qr-modal proof-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-modal-header">
          <h3>Get Cards</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p
          className={`proof-modal-status-note${isMintedCard ? " proof-modal-status-note--minted" : " proof-modal-status-note--draft"}`}
        >
          {isMintedCard
            ? "High-resolution card image ready for production."
            : "This card image is a low-resolution preview until the card is minted."}
        </p>
        <div className="qr-modal-body proof-modal-body">
          <div className="proof-modal-preview-panel">
            {(isCardLoading || isProofLoading) && !blobUrl ? (
              <p className="dash-loading">
                {isMintedCard ? "Rendering proof..." : "Loading preview..."}
              </p>
            ) : null}
            {blobUrl && (
              <img
                className="proof-preview"
                src={blobUrl}
                alt={`Digital proof for ${cardTitle}`}
                onError={() => {
                  setBlobUrl(fallbackPreviewUrl);
                }}
              />
            )}
            {!blobUrl && !isCardLoading && !isProofLoading ? (
              <div className="proof-modal-empty">
                <p className="alert-error">
                  {isMintedCard
                    ? "Failed to render the digital proof. Try again."
                    : "No preview is available yet for this draft."}
                </p>
              </div>
            ) : null}
          </div>
          <div className="proof-modal-actions-panel">
            {isCardError || isProofError ? (
              <p className="alert-error">
                Failed to render the digital proof. Try again.
              </p>
            ) : null}
            {printerFriendlyMutation.isError ? (
              <p className="alert-error">
                Failed to generate the printable PDF. Try again.
              </p>
            ) : null}
            <div className="proof-modal-actions-list">
              {!isMintedCard ? (
                <section className="proof-modal-action-section">
                  <span className="proof-modal-section-label">Mint Card</span>
                  <button
                    type="button"
                    className="btn-gold proof-order-cta"
                    onClick={onMintRequest}
                    disabled={isMintPending}
                  >
                    {isMintPending ? "Minting..." : "Mint This Card"}
                  </button>
                  <p className="proof-order-cta-note">
                    Mint first to unlock digital proofs and QR-ready production
                    output.
                  </p>
                </section>
              ) : null}
              <section className="proof-modal-action-section">
                <span className="proof-modal-section-label">Order Packs</span>
                <div
                  className="proof-modal-pack-options"
                  role="group"
                  aria-label="Choose card pack size"
                >
                  {quantities.map((quantity) =>
                    (() => {
                      const productId = getCatalogProductId(
                        quantity,
                      ) as CardPackProductId;
                      const packPrice = packPrices?.[productId];
                      const buttonCopy = packPrice
                        ? formatStripePrice(packPrice)
                        : "Price unavailable";
                      const isSelected = selectedQuantity === quantity;

                      return (
                        <button
                          key={quantity}
                          type="button"
                          className={`proof-pack-option${isSelected ? " is-selected" : ""}`}
                          onClick={() => onSelectQuantity(quantity)}
                          disabled={isOrderPending}
                          aria-pressed={isSelected}
                        >
                          <span className="proof-pack-option-copy">
                            <strong>{quantity} cards</strong>
                            <span>Deck + Free Minting</span>
                          </span>
                          <span className="proof-pack-option-price">
                            {buttonCopy}
                          </span>
                        </button>
                      );
                    })(),
                  )}
                </div>
                {orderErrorMessage ? (
                  <p className="alert-error">{orderErrorMessage}</p>
                ) : null}
                <button
                  type="button"
                  className="btn-primary proof-order-cta"
                  onClick={onOrderConfirm}
                  disabled={isOrderPending}
                >
                  {isOrderPending
                    ? "Redirecting to Checkout..."
                    : "Proceed to Checkout"}
                </button>
              </section>
              {isMintedCard ? (
                <>
                  <br />
                  <section className="proof-modal-action-section">
                    <span className="proof-modal-section-label">Digital</span>
                    <a
                      className="proof-download-link"
                      href={blobUrl ?? "#"}
                      download={getDownloadFileName(cardTitle, "proof")}
                      aria-disabled={!blobUrl}
                      onClick={(event) => {
                        if (!blobUrl) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <span className="proof-download-link-copy">
                        <strong>PNG Image</strong>
                        <span>Download the current proof as a PNG image.</span>
                      </span>
                      <span className="proof-download-link-meta">PNG</span>
                    </a>
                  </section>
                  <section className="proof-modal-action-section">
                    <span className="proof-modal-section-label">Printable</span>
                    <button
                      type="button"
                      className="proof-download-link proof-download-link--button"
                      onClick={() => printerFriendlyMutation.mutate()}
                      disabled={printerFriendlyMutation.isPending || !blobUrl}
                    >
                      <span className="proof-download-link-copy">
                        <strong>
                          {printerFriendlyMutation.isPending
                            ? "Preparing PDF"
                            : "Generate Labels"}
                        </strong>
                        <span>
                          Compatible with Avery Presta Template 95272.
                        </span>
                      </span>
                      <span className="proof-download-link-meta">PDF</span>
                    </button>
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Coming Soon</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">Upgrade Card</p>
        <div className="qr-modal-body">
          <p>
            This feature is coming soon! We're working on making it even easier
            to upgrade your cards to Premium.
          </p>
        </div>
        <div className="qr-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { accountSubscriptionUntil, refreshAccountProfile } = useAuth();
  const [qrCard, setQrCard] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [proofCard, setProofCard] = useState<{
    id: string;
    title: string;
    minted: boolean;
  } | null>(null);
  const [mintCard, setMintCard] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [mintAcknowledgment, setMintAcknowledgment] = useState("");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPackQuantity, setSelectedPackQuantity] = useState(50);
  const [purchaseErrorMessage, setPurchaseErrorMessage] = useState<
    string | null
  >(null);
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState("");
  const [subscriptionInterval, setSubscriptionInterval] = useState<
    "month" | "year"
  >("year");
  const [cardStatusFilter, setCardStatusFilter] = useState<
    "all" | "draft" | "minted"
  >("all");

  const {
    data: cards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["cards"],
    queryFn: getCards,
  });
  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: getPricing,
  });
  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });
  const [cardSearch, setCardSearch] = useState("");

  const isSubscribed = hasActiveSubscription(accountSubscriptionUntil);
  const selectedPlan = useMemo(
    () =>
      pricingQuery.data?.subscriptionTypes.find(
        (plan) => plan.id === selectedSubscriptionType,
      ) ?? null,
    [pricingQuery.data?.subscriptionTypes, selectedSubscriptionType],
  );

  useEffect(() => {
    const plans = pricingQuery.data?.subscriptionTypes;
    if (!plans || plans.length === 0 || selectedSubscriptionType) {
      return;
    }

    setSelectedSubscriptionType(plans[0].id);
  }, [pricingQuery.data?.subscriptionTypes, selectedSubscriptionType]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    if (subscriptionInterval === "month" && !selectedPlan.prices.monthly) {
      setSubscriptionInterval(selectedPlan.prices.yearly ? "year" : "month");
      return;
    }

    if (subscriptionInterval === "year" && !selectedPlan.prices.yearly) {
      setSubscriptionInterval(selectedPlan.prices.monthly ? "month" : "year");
    }
  }, [selectedPlan, subscriptionInterval]);

  const mintMutation = useMutation({
    mutationFn: (cardId: string) =>
      createTransaction({
        transactionType: "mint",
        idempotencyKey: createIdempotencyKey(),
        currency: "usd",
        mint: { cardId },
      }),
    onSuccess: async (result) => {
      const checkoutUrl = getCheckoutRedirectUrl(result);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      await refreshAccountProfile();
    },
  });

  const purchasePackMutation = useMutation({
    mutationFn: ({ quantity, cardId }: { quantity: number; cardId: string }) =>
      createTransaction({
        transactionType: "purchase_item",
        idempotencyKey: createIdempotencyKey(),
        currency: "usd",
        items: [
          {
            itemType: "card_pack",
            productId: getCatalogProductId(quantity),
            quantity: 1,
          },
        ],
        metadata: {
          cards: [
            {
              cardId,
              quantity,
            },
          ],
        },
      }),
    onMutate: () => {
      setPurchaseErrorMessage(null);
    },
    onSuccess: (result) => {
      const checkoutUrl = getCheckoutRedirectUrl(result);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    },
    onError: (error) => {
      setPurchaseErrorMessage(getPurchaseTransactionErrorMessage(error));
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: () =>
      createTransaction({
        transactionType: "subscription",
        idempotencyKey: createIdempotencyKey(),
        currency: "usd",
        subscription: {
          subscriptionType: selectedSubscriptionType,
          interval: subscriptionInterval,
        },
      }),
    onSuccess: async (result) => {
      const checkoutUrl = getCheckoutRedirectUrl(result);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await refreshAccountProfile();
    },
  });

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
  const isCancellationScheduled =
    (latestSubscriptionTransaction?.status ?? "").toLowerCase() === "paid" &&
    latestSubscriptionTransaction?.cancel_at_period_end === true;

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

  const mintedCount = cards?.filter((c) => isMinted(c.minted)).length ?? 0;
  const draftCount = (cards?.length ?? 0) - mintedCount;
  const draftLimit = isSubscribed
    ? (selectedPlan?.maxDraftsSubscribed ?? 10)
    : 3;
  const monthlyMintAllowance = isSubscribed
    ? (selectedPlan?.monthlyMintLimit ?? 2)
    : 0;
  const monthlyMintTransactions = useMemo(() => {
    const now = new Date();
    const records = transactionsQuery.data ?? [];
    return records.filter((tx) => {
      if (tx.order_type !== "mint") {
        return false;
      }

      const status = (tx.status ?? "").toLowerCase();
      if (
        status === "cancelled" ||
        status === "canceled" ||
        status === "failed" ||
        status === "expired"
      ) {
        return false;
      }

      if (!tx.create_time) {
        return false;
      }

      const createdAt = new Date(tx.create_time);
      return (
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth()
      );
    }).length;
  }, [transactionsQuery.data]);
  const monthlyMintsUsed = Math.min(
    monthlyMintAllowance,
    monthlyMintTransactions,
  );
  const monthlyMintsRemaining = Math.max(
    monthlyMintAllowance - monthlyMintsUsed,
    0,
  );
  const purchaseItemOrders = useMemo(() => {
    return (transactionsQuery.data ?? [])
      .filter(
        (tx) =>
          tx.order_type === "purchase_item" &&
          (tx.status ?? "").toLowerCase() === "paid",
      )
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.create_time ?? "").getTime();
        const bTime = new Date(b.create_time ?? "").getTime();
        return bTime - aTime;
      });
  }, [transactionsQuery.data]);
  const filteredCards =
    cards?.filter((card) => {
      const matchesSearch = card.data.title
        .toLowerCase()
        .includes(cardSearch.trim().toLowerCase());
      if (!matchesSearch) {
        return false;
      }

      if (cardStatusFilter === "all") {
        return true;
      }

      const minted = isMinted(card.minted);
      return cardStatusFilter === "minted" ? minted : !minted;
    }) ?? [];

  return (
    <div className="page-stack">
      {qrCard && (
        <QrModal
          cardId={qrCard.id}
          cardTitle={qrCard.title}
          onClose={() => setQrCard(null)}
        />
      )}
      {proofCard && (
        <ProofModal
          cardId={proofCard.id}
          cardTitle={proofCard.title}
          isMintedCard={proofCard.minted}
          selectedQuantity={selectedPackQuantity}
          packPrices={pricingQuery.data?.cardPacks ?? null}
          onSelectQuantity={(quantity) => {
            setSelectedPackQuantity(quantity);
            setPurchaseErrorMessage(null);
          }}
          onOrderConfirm={() =>
            purchasePackMutation.mutate({
              quantity: selectedPackQuantity,
              cardId: proofCard.id,
            })
          }
          onMintRequest={() => {
            setProofCard(null);
            setMintAcknowledgment("");
            setMintCard({
              id: proofCard.id,
              title: proofCard.title,
            });
          }}
          isMintPending={mintMutation.isPending}
          isOrderPending={purchasePackMutation.isPending}
          orderErrorMessage={purchaseErrorMessage}
          onClose={() => {
            setProofCard(null);
            setPurchaseErrorMessage(null);
          }}
        />
      )}
      {mintCard && (
        <MintCardModal
          cardTitle={mintCard.title}
          mintPrice={pricingQuery.data?.mint ?? null}
          isSubscribed={isSubscribed}
          mintDiscountPercent={selectedPlan?.mintDiscountPercent}
          freeMintsRemaining={monthlyMintsRemaining}
          acknowledgment={mintAcknowledgment}
          onAcknowledgmentChange={setMintAcknowledgment}
          onManageSubscriptions={() => {
            setMintCard(null);
            setMintAcknowledgment("");
            setShowPlanModal(true);
          }}
          onClose={() => {
            if (mintMutation.isPending) {
              return;
            }

            setMintCard(null);
            setMintAcknowledgment("");
          }}
          isPending={mintMutation.isPending}
          onConfirm={() => {
            mintMutation.mutate(mintCard.id, {
              onSuccess: async () => {
                setMintCard(null);
                setMintAcknowledgment("");
              },
            });
          }}
        />
      )}
      {showPlanModal ? (
        <PlanModal
          onClose={() => setShowPlanModal(false)}
          plans={pricingQuery.data?.subscriptionTypes ?? []}
          selectedPlanId={selectedSubscriptionType}
          onSelectPlan={setSelectedSubscriptionType}
          selectedInterval={subscriptionInterval}
          onSelectInterval={setSubscriptionInterval}
          onStartSubscription={() => {
            if (isCancellationScheduled) {
              resumeSubscriptionMutation.mutate();
              return;
            }

            subscribeMutation.mutate();
          }}
          onResumeSubscription={() => resumeSubscriptionMutation.mutate()}
          isCancellationScheduled={isCancellationScheduled}
          isResumePending={resumeSubscriptionMutation.isPending}
          isStartPending={
            subscribeMutation.isPending || resumeSubscriptionMutation.isPending
          }
          isSubscribed={isSubscribed}
          mintPrice={pricingQuery.data?.mint ?? null}
        />
      ) : null}
      {showUpgradeModal && (
        <ComingSoonModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {/* ── Hero Banner ── */}
      <section className="content-hero">
        <div>
          {/* <p className="dash-kicker">⚔ Let the Adventure Begin!</p> */}
          <h1>Let the Adventure Begin</h1>
          <p className="content-hero-copy">
            Your profiles are ready to be unleashed. Forge new cards, track
            orders, and level up your legendary presence.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowPlanModal(true)}
        >
          Compare Plans
        </button>
      </section>

      {/* ── Dashboard Body ── */}
      <div className="dash-body">
        {/* ── Main Column ── */}
        <div className="dash-main">
          {/* Plan summary band */}
          <div className="dash-plan-band">
            <div className="dash-plan-stats">
              <div className="dash-plan-stat">
                <span className="dash-plan-stat-value">
                  {draftCount} / {draftLimit}
                </span>
                <span className="dash-plan-stat-label">Drafts Used</span>
              </div>
              <div className="dash-plan-divider" />
              <div className="dash-plan-stat">
                <span className="dash-plan-stat-value">
                  {monthlyMintsUsed} / {monthlyMintAllowance}
                </span>
                <span className="dash-plan-stat-label">
                  Free Monthly Mints Used
                </span>
              </div>
            </div>
          </div>

          {/* My Cards */}
          <section className="dash-panel">
            <div className="dash-panel-header">
              <div className="dash-panel-heading-block">
                <h2 className="dash-panel-title">My Cards</h2>
                <span className="meta-pill">
                  {filteredCards.length} shown / {cards?.length ?? 0} total
                </span>
              </div>
              <label className="dash-search-field" aria-label="Search cards">
                <span className="dash-search-icon">⌕</span>
                <input
                  type="search"
                  value={cardSearch}
                  onChange={(event) => setCardSearch(event.target.value)}
                  placeholder="Search by title"
                />
              </label>
              <div
                className="dash-filter-group"
                role="group"
                aria-label="Filter card status"
              >
                <button
                  type="button"
                  className={
                    cardStatusFilter === "all"
                      ? "dash-filter-btn dash-filter-btn--active"
                      : "dash-filter-btn"
                  }
                  onClick={() => setCardStatusFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={
                    cardStatusFilter === "draft"
                      ? "dash-filter-btn dash-filter-btn--active"
                      : "dash-filter-btn"
                  }
                  onClick={() => setCardStatusFilter("draft")}
                >
                  Draft
                </button>
                <button
                  type="button"
                  className={
                    cardStatusFilter === "minted"
                      ? "dash-filter-btn dash-filter-btn--active"
                      : "dash-filter-btn"
                  }
                  onClick={() => setCardStatusFilter("minted")}
                >
                  Minted
                </button>
              </div>
            </div>

            {isLoading && <p className="dash-loading">Summoning your cards…</p>}
            {isError && (
              <p className="alert-error">
                The scroll is damaged. Failed to load cards.
              </p>
            )}

            {!isLoading && !isError && (cards?.length ?? 0) === 0 && (
              <div className="dash-empty">
                <p className="dash-empty-icon">🃏</p>
                <h3>Your deck is empty</h3>
                <p>
                  Your legend hasn't been written yet. Create your first card to
                  begin your adventure.
                </p>
                <Link
                  className="btn-primary dash-empty-cta"
                  to="/app/cards/new"
                >
                  Forge Your First Card
                </Link>
              </div>
            )}

            {!isLoading && !isError && (cards?.length ?? 0) > 0 && (
              <div className="dash-cards-grid">
                {filteredCards.map((card, i) => {
                  const cardBorderTint =
                    CARD_TINT_BORDERS[i % CARD_TINT_BORDERS.length];
                  const minted = isMinted(card.minted);

                  return (
                    <article key={card.id} className="dash-card-item">
                      <div className="dash-card-stack">
                        <Link
                          className="dash-card-link"
                          to={`/app/cards/${card.id}`}
                        >
                          <div
                            className={`dash-card-stage${minted ? " dash-card-stage--minted" : ""}`}
                            style={{
                              backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.82)), ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]}`,
                            }}
                          >
                            <div className="dash-card-face">
                              {card.last_render ? (
                                <img
                                  className="dash-card-render"
                                  src={card.last_render}
                                  alt={card.data.title}
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = "none";
                                    const sibling =
                                      target.nextElementSibling as HTMLElement | null;
                                    if (sibling) sibling.style.display = "flex";
                                  }}
                                />
                              ) : null}
                              <span
                                className="dash-card-initial"
                                style={
                                  card.last_render
                                    ? { display: "none" }
                                    : undefined
                                }
                              >
                                {card.data.title?.[0]?.toUpperCase() ?? "?"}
                              </span>
                              {minted ? (
                                <span className="card-tier-badge card-tier-badge--premium">
                                  ✦ Minted
                                </span>
                              ) : (
                                <span className="card-tier-badge card-tier-badge--draft">
                                  Draft
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                        <div
                          className={`dash-card-actions${minted ? " dash-card-actions--premium" : " dash-card-actions--draft"}`}
                          style={{ borderColor: cardBorderTint }}
                        >
                          <button
                            type="button"
                            className="dash-action-btn dash-action-btn--proof"
                            onClick={() =>
                              setProofCard({
                                id: card.id,
                                title: card.data.title,
                                minted,
                              })
                            }
                          >
                            <span
                              className="dash-action-btn-icon"
                              aria-hidden="true"
                            >
                              📦
                            </span>
                            Get Cards
                          </button>
                          {minted ? (
                            <button
                              type="button"
                              className="dash-action-btn dash-action-btn--qr"
                              onClick={() =>
                                setQrCard({
                                  id: card.id,
                                  title: card.data.title,
                                })
                              }
                            >
                              <span
                                className="dash-action-btn-icon"
                                aria-hidden="true"
                              >
                                ◉
                              </span>
                              QR Code
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!isLoading &&
              !isError &&
              (cards?.length ?? 0) > 0 &&
              filteredCards.length === 0 && (
                <div className="dash-empty dash-empty--search">
                  <p className="dash-empty-icon">🔎</p>
                  <h3>No matching cards</h3>
                  <p>Try a different title or clear the search field.</p>
                </div>
              )}
          </section>
        </div>

        {/* ── Sidebar ── */}
        <aside className="dash-sidebar">
          <div className="dash-panel">
            <h3 className="dash-panel-title">Quick Actions</h3>
            <nav className="dash-quick-list">
              <Link className="dash-quick-item" to="/app/cards/new">
                <div className="dash-quick-icon">✦</div>
                <div>
                  <span className="dash-quick-label">Create New Card</span>
                  <span className="dash-quick-sub">Start your next legend</span>
                </div>
              </Link>
              <Link className="dash-quick-item" to="/app/settings">
                <div className="dash-quick-icon">⚙</div>
                <div>
                  <span className="dash-quick-label">Manage Subscription</span>
                  <span className="dash-quick-sub">
                    {isSubscribed ? "Subscription Active" : "Not Subscribed"}
                  </span>
                </div>
              </Link>
              <a className="dash-quick-item dash-quick-item--locked" href="#">
                <div className="dash-quick-icon">🔗</div>
                <div>
                  <span className="dash-quick-label">Card Analytics</span>
                  <span className="dash-quick-sub dash-quick-sub--pro">
                    ✦ Coming Soon
                  </span>
                </div>
              </a>
            </nav>
          </div>

          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">Orders</h3>
              <span className="meta-pill">
                {purchaseItemOrders.length} orders
              </span>
            </div>
            {transactionsQuery.isLoading ? (
              <p className="dash-loading">Loading orders...</p>
            ) : null}
            {transactionsQuery.isError ? (
              <p className="alert-error">Failed to load orders.</p>
            ) : null}
            {!transactionsQuery.isLoading &&
            !transactionsQuery.isError &&
            purchaseItemOrders.length === 0 ? (
              <div className="dash-orders-empty">
                <div className="dash-orders-empty-icon">📜</div>
                <p>No purchase orders yet.</p>
                <p>
                  Card pack purchases will appear here with their current
                  payment status.
                </p>
              </div>
            ) : null}
            {!transactionsQuery.isLoading &&
            !transactionsQuery.isError &&
            purchaseItemOrders.length > 0 ? (
              <div className="dash-quick-list" aria-label="Purchase orders">
                {purchaseItemOrders.map((order) => (
                  <article key={order.id} className="dash-quick-item">
                    <div className="dash-quick-icon">📦</div>
                    <div>
                      <span className="dash-quick-label">
                        {getOrderDescription(order)}
                      </span>
                      <span className="dash-quick-sub">
                        Paid {formatOrderAmount(order)} ·{" "}
                        {formatTransactionDate(order.create_time)} · Status:{" "}
                        {formatOrderStatus(order.status)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
