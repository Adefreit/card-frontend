import { type StripePriceSummary } from "../../transactions/api";

interface MintCardModalProps {
  cardTitle: string;
  mintPrice?: StripePriceSummary | null;
  isSubscribed: boolean;
  mintDiscountPercent?: number;
  freeMintsRemaining?: number;
  acknowledgment: string;
  onAcknowledgmentChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  onManageSubscriptions: () => void;
  isPending: boolean;
}

function formatStripePrice(price: StripePriceSummary) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.unitAmountCents / 100);
}

const MINT_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%232564eb'/%3E%3Cstop offset='100%25' stop-color='%230ea5e9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='3' y='3' width='50' height='50' rx='14' fill='url(%23g)'/%3E%3Cpath d='M20 29.5 25.6 35 37 23.6' stroke='white' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

const LOCK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'%3E%3Ccircle cx='22' cy='22' r='22' fill='%23fef3c7'/%3E%3Crect x='12' y='20' width='20' height='14' rx='3' fill='%23b45309'/%3E%3Cpath d='M16.5 20v-3a5.5 5.5 0 0 1 11 0v3' stroke='%23b45309' stroke-width='3' fill='none'/%3E%3C/svg%3E";

const PRICE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'%3E%3Ccircle cx='22' cy='22' r='22' fill='%23dcfce7'/%3E%3Cpath d='M22 10v24M27.8 14.5c-1.2-1-3.2-1.8-5.8-1.8-3.4 0-5.7 1.7-5.7 4.2 0 2.4 1.8 3.5 5.8 4.5 3.7.9 5.2 2 5.2 4.2 0 2.5-2.2 4.2-5.8 4.2-2.7 0-4.9-.9-6.4-2.1' stroke='%2315803d' stroke-width='2.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";

const SUBSCRIPTION_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'%3E%3Ccircle cx='22' cy='22' r='22' fill='%23ede9fe'/%3E%3Cpath d='M22 13.5v17M13.5 22h17' stroke='%236d28d9' stroke-width='3.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";

export default function MintCardModal({
  cardTitle,
  mintPrice,
  isSubscribed,
  mintDiscountPercent,
  freeMintsRemaining,
  acknowledgment,
  onAcknowledgmentChange,
  onConfirm,
  onClose,
  onManageSubscriptions,
  isPending,
}: MintCardModalProps) {
  const requiredPhrase = "I UNDERSTAND";
  const canConfirm = acknowledgment.trim().toUpperCase() === requiredPhrase;
  const mintPriceLabel = mintPrice
    ? formatStripePrice(mintPrice)
    : "the listed checkout price";
  const effectiveDiscountPercent = Math.max(0, mintDiscountPercent ?? 0);
  const discountedMintPrice =
    mintPrice && effectiveDiscountPercent > 0
      ? {
          ...mintPrice,
          unitAmountCents: Math.round(
            mintPrice.unitAmountCents * (1 - effectiveDiscountPercent / 100),
          ),
        }
      : null;

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal mint-modal" onClick={(e) => e.stopPropagation()}>
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
        <div className="qr-modal-body mint-modal-body">
          <section className="mint-modal-hero-strip" aria-hidden="true">
            <img src={MINT_ICON} alt="" className="mint-modal-hero-icon" />
            <div>
              <strong>Minting Creates Your Print-Ready Card</strong>
              <p>
                You get the digital proof(s), label templates, dynamic QR
                experience and the card becomes game-ready.
              </p>
            </div>
          </section>

          <div className="mint-modal-flow">
            <section className="mint-modal-item">
              <img
                src={LOCK_ICON}
                alt="Visual lock after mint"
                className="mint-modal-item-icon"
              />
              <div>
                <h4>Minting a Card Locks its Visual Appearance Forever</h4>
                <p>
                  Make sure your card looks exactly how you want it before
                  minting. You can still update your contact info and any
                  content displayed after scanning the dynamic QR code.
                </p>
              </div>
            </section>
          </div>

          <div className="mint-modal-flow">
            <section className="mint-modal-item">
              <img
                src={PRICE_ICON}
                alt="Mint pricing"
                className="mint-modal-item-icon"
              />
              <div>
                <h4>Pricing</h4>
                <p>
                  Minting is a one-time fee. Current base checkout price is{" "}
                  <strong>{mintPriceLabel}</strong>.
                </p>
                {isSubscribed ? (
                  <>
                    {discountedMintPrice ? (
                      <p className="mint-modal-subscriber-note">
                        Subscriber discount: {effectiveDiscountPercent}% off.
                        Base price: <strong>{mintPriceLabel}</strong>.
                        Discounted price:{" "}
                        <strong>
                          {formatStripePrice(discountedMintPrice)}
                        </strong>
                        .
                      </p>
                    ) : null}
                    <p className="mint-modal-subscriber-note">
                      {typeof freeMintsRemaining === "number" &&
                      freeMintsRemaining > 0
                        ? `You have ${freeMintsRemaining} free mint${freeMintsRemaining === 1 ? "" : "s"} remaining this month, so this mint should be free.`
                        : "You have no free mints remaining this month, so this mint will be charged at checkout."}
                    </p>
                  </>
                ) : null}
              </div>
            </section>

            {!isSubscribed ? (
              <section className="mint-modal-item mint-modal-item--subscription">
                <img
                  src={SUBSCRIPTION_ICON}
                  alt="Subscription savings"
                  className="mint-modal-item-icon"
                />
                <div>
                  <h4>Discounts Available</h4>
                  <p>Subscribe to receive free mints and monthly discounts.</p>
                  <p>
                    Also, ordering a card pack will automatically mint your card
                    AND give you a trial subscription.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onManageSubscriptions}
                >
                  View Options
                </button>
              </section>
            ) : null}
          </div>

          <section className="mint-modal-ack">
            <br />
            <div>
              <center>
                Type <strong>{requiredPhrase}</strong> to confirm you understand
                these minting terms.
              </center>
            </div>
            <input
              type="text"
              value={acknowledgment}
              onChange={(event) => onAcknowledgmentChange(event.target.value)}
              placeholder={requiredPhrase}
              autoComplete="off"
            />
          </section>
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
            {isPending ? "Minting..." : "Proceed"}
          </button>
        </div>
      </div>
    </div>
  );
}
