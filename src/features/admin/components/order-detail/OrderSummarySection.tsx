import { Link } from "react-router-dom";
import type { AdminOrderRecord } from "../../api";
import type { AdminSafeUser } from "../../api";
import { formatDate, shortId } from "../../utils";

interface OrderSummarySectionProps {
  order: AdminOrderRecord;
  relatedUser: AdminSafeUser | null;
  summaryWhatWasOrdered: string;
}

export function OrderSummarySection({
  order,
  relatedUser,
  summaryWhatWasOrdered,
}: OrderSummarySectionProps) {
  return (
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
  );
}
