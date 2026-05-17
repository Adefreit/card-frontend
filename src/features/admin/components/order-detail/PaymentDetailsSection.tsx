import type { AdminOrderRecord } from "../../api";
import { capitalize, formatCents } from "../../utils";

interface PaymentDetailsSectionProps {
  order: AdminOrderRecord;
  canRefund: boolean;
  onRefundClick: () => void;
}

export function PaymentDetailsSection({
  order,
  canRefund,
  onRefundClick,
}: PaymentDetailsSectionProps) {
  return (
    <div className="admin-order-section">
      <div className="admin-order-section-header">
        <div className="admin-payment-title-row">
          <p className="admin-order-section-title" style={{ margin: 0 }}>
            Payment Details
          </p>
          <span className="admin-payment-provider-chip">
            {capitalize(order.payment_provider)}
          </span>
        </div>
      </div>

      {order.provider_checkout_id ? (
        <div className="admin-payment-info-row">
          <span className="admin-payment-badge">
            <span className="admin-payment-badge__label">Checkout</span>
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
          <button type="button" className="btn-danger" onClick={onRefundClick}>
            Issue Refund
          </button>
        </div>
      ) : null}
    </div>
  );
}
