import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuth } from "../../auth/auth-context";
import {
  getCard,
  renderCardProof,
  renderCardProofPrinterFriendly,
} from "../api";
import MintCardModal from "../components/MintCardModal";
import {
  type CardPackProductId,
  createIdempotencyKey,
  createTransaction,
  getCheckoutRedirectUrl,
  getPricing,
  getTransactions,
  type StripePriceSummary,
} from "../../transactions/api";

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

export default function GetCardsPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { accountSubscriptionUntil, refreshAccountProfile } = useAuth();
  const [selectedQuantity, setSelectedQuantity] = useState(50);
  const [purchaseErrorMessage, setPurchaseErrorMessage] = useState<
    string | null
  >(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [proofImageLoaded, setProofImageLoaded] = useState(false);
  const [mintAcknowledgment, setMintAcknowledgment] = useState("");
  const [showMintModal, setShowMintModal] = useState(false);
  const packDropdownRef = useRef<HTMLDetailsElement | null>(null);
  const generatedProofUrlRef = useRef<string | null>(null);

  const cardQuery = useQuery({
    queryKey: ["card-proof-source", cardId],
    queryFn: () => getCard(cardId as string),
    enabled: Boolean(cardId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: getPricing,
  });
  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });

  const isMintedCard = Boolean(cardQuery.data?.minted);
  const cardTitle = cardQuery.data?.data.title ?? "Card";
  const isSubscribed = hasActiveSubscription(accountSubscriptionUntil);
  const selectedPlan = pricingQuery.data?.subscriptionTypes[0] ?? null;
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

  const shouldRenderMintedProof =
    isMintedCard && !(cardQuery.data?.last_proof ?? null);
  const proofQuery = useQuery({
    queryKey: ["card-proof-fallback", cardId],
    queryFn: () => renderCardProof(cardId as string),
    enabled: Boolean(cardId) && shouldRenderMintedProof,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const resolvedPreviewUrl = isMintedCard
    ? (cardQuery.data?.last_proof ?? null)
    : (cardQuery.data?.last_render ?? null);
  const packOptions = [50, 100, 500, 1000].map((quantity) => {
    const productId = getCatalogProductId(quantity) as CardPackProductId;
    const packPrice = pricingQuery.data?.cardPacks?.[productId] as
      | StripePriceSummary
      | undefined;

    return {
      quantity,
      subtitle: "Deck + Free Minting",
      priceLabel: packPrice
        ? formatStripePrice(packPrice)
        : "Price unavailable",
    };
  });
  const selectedPackOption =
    packOptions.find((option) => option.quantity === selectedQuantity) ??
    packOptions[0];
  const canDownloadProofAssets = Boolean(blobUrl) && proofImageLoaded;

  useEffect(() => {
    if (proofQuery.data) {
      if (generatedProofUrlRef.current) {
        URL.revokeObjectURL(generatedProofUrlRef.current);
      }

      const nextBlobUrl = URL.createObjectURL(proofQuery.data);
      generatedProofUrlRef.current = nextBlobUrl;
      setBlobUrl(nextBlobUrl);
      return;
    }

    if (generatedProofUrlRef.current) {
      URL.revokeObjectURL(generatedProofUrlRef.current);
      generatedProofUrlRef.current = null;
    }

    setBlobUrl(resolvedPreviewUrl);
  }, [proofQuery.data, resolvedPreviewUrl]);

  useEffect(() => {
    return () => {
      if (generatedProofUrlRef.current) {
        URL.revokeObjectURL(generatedProofUrlRef.current);
        generatedProofUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setProofImageLoaded(false);
  }, [blobUrl]);

  const purchasePackMutation = useMutation({
    mutationFn: ({
      quantity,
      selectedCardId,
    }: {
      quantity: number;
      selectedCardId: string;
    }) =>
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
              cardId: selectedCardId,
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

  const mintMutation = useMutation({
    mutationFn: (selectedCardId: string) =>
      createTransaction({
        transactionType: "mint",
        idempotencyKey: createIdempotencyKey(),
        currency: "usd",
        mint: { cardId: selectedCardId },
      }),
    onSuccess: async (result) => {
      const checkoutUrl = getCheckoutRedirectUrl(result);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({
        queryKey: ["card-proof-source", cardId],
      });
      await refreshAccountProfile();
    },
  });

  const printerFriendlyMutation = useMutation({
    mutationFn: () => renderCardProofPrinterFriendly(cardId as string),
    onSuccess: (blob) => {
      downloadBlobFile(blob, getPdfDownloadFileName(cardTitle));
    },
  });

  if (!cardId) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="page-stack">
      {showMintModal ? (
        <MintCardModal
          cardTitle={cardTitle}
          mintPrice={pricingQuery.data?.mint ?? null}
          isSubscribed={isSubscribed}
          mintDiscountPercent={selectedPlan?.mintDiscountPercent}
          freeMintsRemaining={monthlyMintsRemaining}
          acknowledgment={mintAcknowledgment}
          onAcknowledgmentChange={setMintAcknowledgment}
          onManageSubscriptions={() => {
            setShowMintModal(false);
            setMintAcknowledgment("");
            navigate("/app/settings");
          }}
          onClose={() => {
            if (mintMutation.isPending) {
              return;
            }

            setShowMintModal(false);
            setMintAcknowledgment("");
          }}
          isPending={mintMutation.isPending}
          onConfirm={() => {
            mintMutation.mutate(cardId, {
              onSuccess: async () => {
                setShowMintModal(false);
                setMintAcknowledgment("");
              },
            });
          }}
        />
      ) : null}

      <section className="content-hero">
        <div>
          <h1>Get Cards</h1>
          <p className="content-hero-copy">
            Finalize this card for print and downloads. Mint to unlock
            high-resolution production output.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/dashboard">
          Back to Dashboard
        </Link>
      </section>

      <section className="content-card content-card-wide">
        <div className="row-between">
          <h2>{cardTitle}</h2>
          <Link className="btn-secondary" to={`/app/cards/${cardId}`}>
            Open Card Details
          </Link>
        </div>

        <p
          className={`proof-modal-status-note${isMintedCard ? " proof-modal-status-note--minted" : " proof-modal-status-note--draft"}`}
        >
          {isMintedCard
            ? "High-resolution card image ready for production."
            : "This card image is a low-resolution preview until the card is minted."}
        </p>

        <div className="proof-modal-body" style={{ marginTop: 14 }}>
          <div className="proof-modal-preview-panel">
            {(cardQuery.isLoading ||
              (shouldRenderMintedProof && proofQuery.isLoading)) &&
            !blobUrl ? (
              <p className="dash-loading">
                {isMintedCard ? "Rendering proof..." : "Loading preview..."}
              </p>
            ) : null}
            {blobUrl ? (
              <img
                className="proof-preview"
                src={blobUrl}
                alt={`Digital proof for ${cardTitle}`}
                onLoad={() => {
                  setProofImageLoaded(true);
                }}
                onError={() => {
                  setProofImageLoaded(false);
                  setBlobUrl(null);
                }}
              />
            ) : null}

            {!blobUrl && !cardQuery.isLoading && isMintedCard ? (
              <div
                className="proof-loading-state"
                role="status"
                aria-live="polite"
              >
                <span className="proof-loading-spinner" aria-hidden="true" />
                <p className="dash-loading">Proof is still being prepared...</p>
              </div>
            ) : null}

            {!blobUrl && !cardQuery.isLoading && !isMintedCard ? (
              <div className="proof-modal-empty">
                <p className="alert-error">
                  No preview is available yet for this draft.
                </p>
              </div>
            ) : null}
          </div>

          <div className="proof-modal-actions-panel">
            {cardQuery.isError || proofQuery.isError ? (
              <p className="alert-error">
                Failed to load card preview data. Try again.
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
                    onClick={() => {
                      setMintAcknowledgment("");
                      setShowMintModal(true);
                    }}
                    disabled={mintMutation.isPending}
                  >
                    {mintMutation.isPending ? "Minting..." : "Mint This Card"}
                  </button>
                  <p className="proof-order-cta-note">
                    Unlocks digital proofs and templates. Automatically obtained
                    if you buy a card pack.
                  </p>
                </section>
              ) : null}

              <section className="proof-modal-action-section">
                <span className="proof-modal-section-label">Order Packs</span>
                <details className="proof-pack-dropdown" ref={packDropdownRef}>
                  <summary className="proof-pack-dropdown-trigger">
                    <span className="proof-pack-option-copy">
                      <strong>{selectedPackOption.quantity} cards</strong>
                      <span>{selectedPackOption.subtitle}</span>
                    </span>
                    <span className="proof-pack-dropdown-meta">
                      <span className="proof-pack-option-price">
                        {selectedPackOption.priceLabel}
                      </span>
                      <span className="proof-pack-dropdown-caret" aria-hidden>
                        ▾
                      </span>
                    </span>
                  </summary>
                  <div
                    className="proof-pack-dropdown-menu"
                    role="listbox"
                    aria-label="Choose card pack size"
                  >
                    {packOptions.map((option) => {
                      const isSelected = option.quantity === selectedQuantity;

                      return (
                        <button
                          key={option.quantity}
                          type="button"
                          className={`proof-pack-option${isSelected ? " is-selected" : ""}`}
                          onClick={() => {
                            setSelectedQuantity(option.quantity);
                            setPurchaseErrorMessage(null);
                            packDropdownRef.current?.removeAttribute("open");
                          }}
                          disabled={purchasePackMutation.isPending}
                          aria-pressed={isSelected}
                        >
                          <span className="proof-pack-option-copy">
                            <strong>{option.quantity} cards</strong>
                            <span>{option.subtitle}</span>
                          </span>
                          <span className="proof-pack-option-price">
                            {option.priceLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </details>

                {purchaseErrorMessage ? (
                  <p className="alert-error">{purchaseErrorMessage}</p>
                ) : null}

                <button
                  type="button"
                  className="btn-primary proof-order-cta"
                  onClick={() =>
                    purchasePackMutation.mutate({
                      quantity: selectedQuantity,
                      selectedCardId: cardId,
                    })
                  }
                  disabled={purchasePackMutation.isPending}
                >
                  {purchasePackMutation.isPending
                    ? "Redirecting to Checkout..."
                    : "Proceed to Checkout"}
                </button>
              </section>

              {isMintedCard ? (
                <>
                  <br />
                  <section className="proof-modal-action-section">
                    <span className="proof-modal-section-label">
                      Digital Proof
                    </span>
                    <a
                      className="proof-download-link"
                      href={blobUrl ?? "#"}
                      download={getDownloadFileName(cardTitle, "proof")}
                      aria-disabled={!canDownloadProofAssets}
                      onClick={(event) => {
                        if (!canDownloadProofAssets) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <span className="proof-download-link-copy">
                        <strong>PNG Image</strong>
                        <span>
                          Download the current proof as a lossless image.
                        </span>
                      </span>
                      <span className="proof-download-link-meta">PNG</span>
                    </a>
                  </section>
                  <section className="proof-modal-action-section">
                    <span className="proof-modal-section-label"> Labels</span>
                    <button
                      type="button"
                      className="proof-download-link proof-download-link--button"
                      onClick={() => printerFriendlyMutation.mutate()}
                      disabled={
                        printerFriendlyMutation.isPending ||
                        !canDownloadProofAssets
                      }
                    >
                      <span className="proof-download-link-copy">
                        <strong>
                          {printerFriendlyMutation.isPending
                            ? "Preparing PDF"
                            : "Avery 95272 Template"}
                        </strong>
                        <span>
                          Download a PDF containing 6 labels formatted for Avery
                          95272 perforated sheets.
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
      </section>
    </div>
  );
}
