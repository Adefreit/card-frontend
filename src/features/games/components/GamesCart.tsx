import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useGamesCart } from "../context";
import {
  createIdempotencyKey,
  createTransaction,
  getCheckoutRedirectUrl,
} from "../../transactions/api";

export function GamesCart() {
  const { items, updateQuantity, removeItem } = useGamesCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 980px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 980px)");

    const handleChange = (event: MediaQueryListEvent) => {
      setIsCollapsed(event.matches);
    };

    setIsCollapsed(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const total = items.reduce(
    (sum, i) => sum + i.unitAmountCents * i.quantity,
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  async function handleCheckout() {
    if (items.length === 0 || isCheckingOut) {
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const response = await createTransaction({
        transactionType: "purchase_item",
        idempotencyKey: createIdempotencyKey(),
        currency: (items[0]?.currency ?? "usd").toLowerCase(),
        items: items.map((item) => ({
          itemType: "game_pack",
          productId: item.gameId,
          quantity: item.quantity,
        })),
      });

      const redirectUrl = getCheckoutRedirectUrl(response);
      if (!redirectUrl) {
        throw new Error("Checkout URL missing from transaction response.");
      }

      window.location.assign(redirectUrl);
    } catch (error) {
      if (isAxiosError(error)) {
        const data = error.response?.data;
        const message =
          typeof data === "object" && data !== null && "response" in data
            ? String((data as { response?: unknown }).response ?? "")
            : "";
        setCheckoutError(
          message || "Unable to start checkout right now. Please try again.",
        );
      } else {
        setCheckoutError(
          "Unable to start checkout right now. Please try again.",
        );
      }
      setIsCheckingOut(false);
    }
  }

  return (
    <aside
      className={`games-cart proof-modal-actions-panel${isCollapsed ? " games-cart--collapsed" : ""}`}
    >
      <div className="games-cart-header">
        <div className="games-cart-header-copy">
          <h4>Shopping Cart</h4>
          <p>
            {items.length === 0
              ? "Your cart is empty."
              : `${itemCount} item${itemCount === 1 ? "" : "s"} · ${new Intl.NumberFormat(
                  undefined,
                  {
                    style: "currency",
                    currency: (items[0]?.currency ?? "usd").toUpperCase(),
                  },
                ).format(total / 100)}`}
          </p>
        </div>
        <button
          type="button"
          className="games-cart-toggle"
          onClick={() => setIsCollapsed((value) => !value)}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? "Open" : "Minimize"}
        </button>
      </div>

      <div className="games-cart__body">
        {items.length === 0 ? (
          <div className="games-cart-empty">Your cart is empty.</div>
        ) : (
          <ul className="games-cart-list">
            {items.map((item) => (
              <li key={item.gameId} className="games-cart-item">
                <span className="games-cart-item-name">{item.gameName}</span>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateQuantity(item.gameId, Number(e.target.value))
                  }
                  className="games-cart-qty"
                />
                <span className="games-cart-item-price">
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "USD",
                  }).format((item.unitAmountCents * item.quantity) / 100)}
                </span>
                <button
                  className="games-cart-remove"
                  onClick={() => removeItem(item.gameId)}
                  aria-label="Remove"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="games-cart-total">
          <span>Subtotal</span>
          <span>
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: (items[0]?.currency ?? "usd").toUpperCase(),
            }).format(total / 100)}
          </span>
        </div>
        {total > 0 && (
          <>
            <div className="games-cart-total games-cart-total--muted">
              <span>Tax</span>
              <span>Added at checkout</span>
            </div>
            <div className="games-cart-total games-cart-total--muted">
              <span>Shipping</span>
              <span>Added at checkout</span>
            </div>
          </>
        )}
        <p className="games-cart-legal-note">
          Please review our <a href="/legal/refund">Refund Policy</a> before
          checking out.
        </p>
        {checkoutError ? <p className="alert-error">{checkoutError}</p> : null}
        <button
          className="btn-primary proof-order-cta games-cart-checkout"
          disabled={items.length === 0 || isCheckingOut}
          onClick={handleCheckout}
        >
          {isCheckingOut ? "Redirecting..." : "Proceed to Checkout"}
        </button>
      </div>
    </aside>
  );
}
