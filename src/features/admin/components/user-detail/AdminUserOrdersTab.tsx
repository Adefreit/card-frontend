import { Link } from "react-router-dom";
import type { AdminOrderRecord } from "../../api";

type AdminUserOrdersTabProps = {
  userId: string;
  orders: AdminOrderRecord[];
  isLoading: boolean;
  isError: boolean;
  fulfillmentStageFilter: string | null;
  onFulfillmentStageFilterChange: (stage: string | null) => void;
};

const FULFILLMENT_STAGES = [
  { value: null, label: "All Stages" },
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "on_hold", label: "On Hold" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AdminUserOrdersTab({
  userId,
  orders,
  isLoading,
  isError,
  fulfillmentStageFilter,
  onFulfillmentStageFilterChange,
}: AdminUserOrdersTabProps) {
  return (
    <div className="admin-table-wrap admin-tab-panel">
      <div className="admin-orders-filter-bar">
        {FULFILLMENT_STAGES.map((stage) => (
          <button
            key={stage.value ?? "all"}
            onClick={() => onFulfillmentStageFilterChange(stage.value)}
            className={[
              "admin-stage-badge",
              stage.value
                ? `admin-stage-badge--${stage.value}`
                : "admin-stage-badge--all",
              fulfillmentStageFilter === stage.value
                ? "admin-stage-badge--selected"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {stage.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="dash-loading">Loading orders...</p>
      ) : isError ? (
        <p className="alert-error">Failed to load orders.</p>
      ) : !orders.length ? (
        <p className="dash-loading">No orders found for this user.</p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Type</th>
                <th>Payment</th>
                <th>Stage</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link
                      className="admin-copy-chip"
                      to={`/app/admin/orders/${order.id}`}
                      state={{ order }}
                      title="Open order details"
                    >
                      {order.id.slice(0, 8)}…
                      <span className="admin-copy-chip__icon">↗</span>
                    </Link>
                  </td>
                  <td>
                    <span className="admin-order-chip">
                      {order.order_type?.replace(/_/g, " ") ?? "-"}
                    </span>
                  </td>
                  <td>
                    <span className="admin-order-chip">
                      {order.status ?? "-"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-stage-badge admin-stage-badge--${order.fulfillment_stage ?? "pending"}`}
                    >
                      {order.fulfillment_stage?.replace(/_/g, " ") ?? "pending"}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {order.create_time
                      ? new Date(order.create_time).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length >= 100 ? (
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ui-muted)",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Showing first 100 orders.{" "}
              <Link to={`/app/admin/orders?userId=${userId}`}>
                View all in Orders page
              </Link>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
