import { useEffect, useMemo, useState } from "react";
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
  const [mintAcknowledgment, setMintAcknowledgment] = useState("");
  const [showMintModal, setShowMintModal] = useState(false);

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

  const proofQuery = useQuery({
    queryKey: ["card-proof", cardId],
    queryFn: () => renderCardProof(cardId as string),
    enabled: Boolean(cardId) && isMintedCard && Boolean(cardQuery.data),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const fallbackPreviewUrl = isMintedCard
    ? (cardQuery.data?.last_proof ?? cardQuery.data?.last_render ?? null)
    : (cardQuery.data?.last_render ?? cardQuery.data?.last_proof ?? null);

  useEffect(() => {
    if (!isMintedCard) {
      setBlobUrl(fallbackPreviewUrl);
      return;
    }

    if (proofQuery.data) {
      const nextBlobUrl = URL.createObjectURL(proofQuery.data);
      setBlobUrl(nextBlobUrl);

      return () => {
        URL.revokeObjectURL(nextBlobUrl);
      };
    }

    setBlobUrl(fallbackPreviewUrl);
  }, [fallbackPreviewUrl, isMintedCard, proofQuery.data]);

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
            {(cardQuery.isLoading || proofQuery.isLoading) && !blobUrl ? (
              <p className="dash-loading">
                {isMintedCard ? "Rendering proof..." : "Loading preview..."}
              </p>
            ) : null}
            {blobUrl ? (
              <img
                className="proof-preview"
                src={blobUrl}
                alt={`Digital proof for ${cardTitle}`}
                onError={() => {
                  setBlobUrl(fallbackPreviewUrl);
                }}
              />
            ) : null}
            {!blobUrl && !cardQuery.isLoading && !proofQuery.isLoading ? (
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
            {cardQuery.isError || proofQuery.isError ? (
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
                    onClick={() => {
                      setMintAcknowledgment("");
                      setShowMintModal(true);
                    }}
                    disabled={mintMutation.isPending}
                  >
                    {mintMutation.isPending ? "Minting..." : "Mint This Card"}
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
                  {[50, 100, 500, 1000].map((quantity) => {
                    const productId = getCatalogProductId(
                      quantity,
                    ) as CardPackProductId;
                    const packPrice = pricingQuery.data?.cardPacks?.[
                      productId
                    ] as StripePriceSummary | undefined;
                    const buttonCopy = packPrice
                      ? formatStripePrice(packPrice)
                      : "Price unavailable";
                    const isSelected = selectedQuantity === quantity;

                    return (
                      <button
                        key={quantity}
                        type="button"
                        className={`proof-pack-option${isSelected ? " is-selected" : ""}`}
                        onClick={() => {
                          setSelectedQuantity(quantity);
                          setPurchaseErrorMessage(null);
                        }}
                        disabled={purchasePackMutation.isPending}
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
                  })}
                </div>

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
      </section>
    </div>
  );
}
