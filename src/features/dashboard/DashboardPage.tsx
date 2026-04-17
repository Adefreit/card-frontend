import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import {
  getCard,
  getCards,
  renderCardProof,
  renderCardProofPrinterFriendly,
} from "../cards/api";
import { apiClient } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  createIdempotencyKey,
  createTransaction,
  getCheckoutRedirectUrl,
} from "../transactions/api";

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

function PlanModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Draft vs. Premium</h3>
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
          Choose the tier that fits your legend.
        </p>
        <div className="plan-compare">
          <div className="plan-col plan-col--draft">
            <div className="plan-col-header">
              <span className="plan-name">Draft</span>
              <span className="plan-price">Free</span>
            </div>
            <ul className="plan-features">
              <li className="plan-feat plan-feat--yes">
                Create / Update Cards
              </li>
              <li className="plan-feat plan-feat--no">Downloadable Proof</li>
              <li className="plan-feat plan-feat--no">Smart QR Codes</li>
              <li className="plan-feat plan-feat--no">
                Analytics &amp; Scan Tracking
              </li>
              <li className="plan-feat plan-feat--no">Link Hub Page</li>
              <li className="plan-feat plan-feat--no">Priority Support</li>
            </ul>
          </div>
          <div className="plan-col plan-col--premium">
            <div className="plan-col-header">
              <span className="plan-name">✦ Premium</span>
              <span className="plan-price">$10.00 / year</span>
            </div>
            <ul className="plan-features">
              <li className="plan-feat plan-feat--yes">
                Create / Update Cards
              </li>
              <li className="plan-feat plan-feat--yes">Downloadable Proof</li>
              <li className="plan-feat plan-feat--yes">Smart QR Codes</li>
              <li className="plan-feat plan-feat--yes">
                Analytics &amp; Scan Tracking
              </li>
              <li className="plan-feat plan-feat--yes">Link Hub Page</li>
              <li className="plan-feat plan-feat--yes">Priority Support</li>
            </ul>
          </div>
        </div>
        <div className="qr-modal-footer">
          <p
            style={{ margin: 0, fontSize: "0.9rem", color: "var(--ui-muted)" }}
          >
            💡 Ordering physical cards will automatically upgrade that card to
            Premium.
          </p>
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
        <p className="qr-modal-subtitle">{cardTitle}</p>
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
          <div className="qr-modal-footer">
            <a
              className="btn-primary"
              href={blobUrl}
              download={`${cardTitle.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
            >
              ⬇ Download PNG
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
  selectedQuantity: number;
  onSelectQuantity: (quantity: number) => void;
  onOrderConfirm: () => void;
  isOrderPending: boolean;
  orderErrorMessage?: string | null;
  onClose: () => void;
}

interface MintWarningModalProps {
  cardTitle: string;
  acknowledgment: string;
  onAcknowledgmentChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
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

function MintWarningModal({
  cardTitle,
  acknowledgment,
  onAcknowledgmentChange,
  onConfirm,
  onClose,
  isPending,
}: MintWarningModalProps) {
  const requiredPhrase = "I UNDERSTAND";
  const canConfirm = acknowledgment.trim().toUpperCase() === requiredPhrase;

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Mint Card</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">{cardTitle}</p>
        <div className="qr-modal-body" style={{ textAlign: "left" }}>
          <p style={{ marginTop: 0 }}>
            Minting this card will lock its appearance. After minting, you will
            no longer be able to change the title, subtitle, flavor text, or
            images.
          </p>
          <label style={{ display: "block", marginTop: "12px" }}>
            <span>Type {requiredPhrase} to continue:</span>
            <input
              type="text"
              value={acknowledgment}
              onChange={(event) => onAcknowledgmentChange(event.target.value)}
              placeholder={requiredPhrase}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="qr-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={!canConfirm || isPending}
          >
            {isPending ? "Minting..." : "I Understand, Mint Card"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProofModal({
  cardId,
  cardTitle,
  selectedQuantity,
  onSelectQuantity,
  onOrderConfirm,
  isOrderPending,
  orderErrorMessage,
  onClose,
}: ProofModalProps) {
  const quantities = [50, 100, 500, 1000] as const;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [useRenderedProof, setUseRenderedProof] = useState(false);
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
    enabled: Boolean(card) && (!card?.last_proof || useRenderedProof),
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

  useEffect(() => {
    if (card?.last_proof && !useRenderedProof) {
      setBlobUrl(card.last_proof);
      return;
    }

    if (!proofBlob) {
      setBlobUrl(null);
      return;
    }

    const nextBlobUrl = URL.createObjectURL(proofBlob);
    setBlobUrl(nextBlobUrl);

    return () => {
      URL.revokeObjectURL(nextBlobUrl);
    };
  }, [card?.last_proof, proofBlob, useRenderedProof]);

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div
        className="qr-modal proof-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-modal-header">
          <h3>Card Packs and Proofs</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="qr-modal-body proof-modal-body">
          <div className="proof-modal-preview-panel">
            {isCardLoading || isProofLoading ? (
              <p className="dash-loading">Rendering proof…</p>
            ) : null}
            {blobUrl && (
              <img
                className="proof-preview"
                src={blobUrl}
                alt={`Digital proof for ${cardTitle}`}
                onError={() => {
                  if (card?.last_proof && !useRenderedProof) {
                    setBlobUrl(null);
                    setUseRenderedProof(true);
                  }
                }}
              />
            )}
            {!blobUrl && !isCardLoading && !isProofLoading ? (
              <div className="proof-modal-empty">
                <p className="alert-error">
                  Failed to render the digital proof. Try again.
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
              <section className="proof-modal-action-section">
                <span className="proof-modal-section-label">Order Packs</span>
                <div
                  className="proof-modal-pack-options"
                  role="group"
                  aria-label="Choose card pack size"
                >
                  {quantities.map((quantity) => (
                    <button
                      key={quantity}
                      type="button"
                      className={
                        selectedQuantity === quantity
                          ? "btn-primary"
                          : "btn-secondary"
                      }
                      onClick={() => onSelectQuantity(quantity)}
                      disabled={isOrderPending}
                    >
                      {quantity}
                    </button>
                  ))}
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
                <p className="proof-order-cta-note">
                  Purchase a {selectedQuantity}-pack using secure checkout.
                </p>
              </section>
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
                    <span>Compatible with Avery Presta Template 95272.</span>
                  </span>
                  <span className="proof-download-link-meta">PDF</span>
                </button>
              </section>
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
  const { accountSubscriptionUntil, userPermissions, refreshAccountProfile } =
    useAuth();
  const [qrCard, setQrCard] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [proofCard, setProofCard] = useState<{
    id: string;
    title: string;
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

  const {
    data: cards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["cards"],
    queryFn: getCards,
  });
  const [cardSearch, setCardSearch] = useState("");

  const hasFounderPermission = userPermissions.includes("FOUNDER");
  const isSubscribed = hasActiveSubscription(accountSubscriptionUntil);

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
    mutationFn: ({ quantity }: { quantity: number }) =>
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
        subscription: { interval: "year" },
      }),
    onSuccess: async (result) => {
      const checkoutUrl = getCheckoutRedirectUrl(result);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      await refreshAccountProfile();
    },
  });

  const mintedCount = cards?.filter((c) => isMinted(c.minted)).length ?? 0;
  const draftCount = (cards?.length ?? 0) - mintedCount;
  const filteredCards =
    cards?.filter((card) =>
      card.data.title.toLowerCase().includes(cardSearch.trim().toLowerCase()),
    ) ?? [];

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
          selectedQuantity={selectedPackQuantity}
          onSelectQuantity={(quantity) => {
            setSelectedPackQuantity(quantity);
            setPurchaseErrorMessage(null);
          }}
          onOrderConfirm={() =>
            purchasePackMutation.mutate({
              quantity: selectedPackQuantity,
            })
          }
          isOrderPending={purchasePackMutation.isPending}
          orderErrorMessage={purchaseErrorMessage}
          onClose={() => {
            setProofCard(null);
            setPurchaseErrorMessage(null);
          }}
        />
      )}
      {mintCard && (
        <MintWarningModal
          cardTitle={mintCard.title}
          acknowledgment={mintAcknowledgment}
          onAcknowledgmentChange={setMintAcknowledgment}
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
      {showPlanModal && <PlanModal onClose={() => setShowPlanModal(false)} />}
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
      </section>

      {/* ── Dashboard Body ── */}
      <div className="dash-body">
        {/* ── Main Column ── */}
        <div className="dash-main">
          {/* Plan summary band */}
          <div className="dash-plan-band">
            <div className="dash-plan-stats">
              <div className="dash-plan-stat">
                <span className="dash-plan-stat-value">{draftCount}</span>
                <span className="dash-plan-stat-label">Draft</span>
              </div>
              <div className="dash-plan-divider" />
              <div className="dash-plan-stat">
                <span className="dash-plan-stat-value dash-plan-stat-value--gold">
                  {mintedCount}
                </span>
                <span className="dash-plan-stat-label">✦ Minted</span>
              </div>
            </div>
            <div className="button-row" style={{ margin: 0 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPlanModal(true)}
              >
                Compare plans
              </button>
              {!isSubscribed ? (
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
              ) : (
                <Link className="btn-secondary" to="/app/settings">
                  Manage Subscription
                </Link>
              )}
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
                          {!minted && (
                            <button
                              type="button"
                              className="dash-action-btn dash-action-btn--upgrade"
                              onClick={() => {
                                setMintAcknowledgment("");
                                setMintCard({
                                  id: card.id,
                                  title: card.data.title,
                                });
                              }}
                              disabled={mintMutation.isPending}
                            >
                              {mintMutation.isPending
                                ? "Minting..."
                                : hasFounderPermission
                                  ? "✦ Mint Free"
                                  : "✦ Mint"}
                            </button>
                          )}
                          {minted ? (
                            <>
                              <button
                                type="button"
                                className="dash-action-btn dash-action-btn--proof"
                                onClick={() =>
                                  setProofCard({
                                    id: card.id,
                                    title: card.data.title,
                                  })
                                }
                              >
                                📦 Packs & Proof
                              </button>
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
                                ◉ QR
                              </button>
                            </>
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
                    {isSubscribed ? "Subscription active" : "Not subscribed"}
                  </span>
                </div>
              </Link>
              <a className="dash-quick-item dash-quick-item--locked" href="#">
                <div className="dash-quick-icon">🔗</div>
                <div>
                  <span className="dash-quick-label">View Link Hub</span>
                  <span className="dash-quick-sub dash-quick-sub--pro">
                    ✦ Pro feature
                  </span>
                </div>
              </a>
            </nav>
          </div>

          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">Orders</h3>
              <span className="meta-pill">0 active</span>
            </div>
            <div className="dash-orders-empty">
              <div className="dash-orders-empty-icon">📜</div>
              <p>No active orders.</p>
              <p>
                When you order physical cards, your quests will appear here
                along with tracking and delivery updates.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
