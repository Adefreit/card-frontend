import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAdminOrders, type AdminOrderRecord } from "../api";

function stageBadgeClass(stage?: string) {
  switch (stage) {
    case "pending":
      return "admin-stage-badge admin-stage-badge--pending";
    case "preparing":
      return "admin-stage-badge admin-stage-badge--preparing";
    case "on_hold":
      return "admin-stage-badge admin-stage-badge--on-hold";
    case "complete":
      return "admin-stage-badge admin-stage-badge--complete";
    case "cancelled":
      return "admin-stage-badge admin-stage-badge--cancelled";
    default:
      return "admin-stage-badge";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function shortId(value?: string) {
  if (!value) return "-";
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[$,]/g, "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function getOrderAmount(order: AdminOrderRecord): string {
  const record = order as unknown as Record<string, unknown>;
  const directAmountKeys = [
    "amount",
    "total",
    "payment_amount",
    "paymentAmount",
    "subtotal",
    "total_amount",
    "totalAmount",
  ];
  const centsAmountKeys = [
    "amount_cents",
    "amountCents",
    "total_cents",
    "totalCents",
  ];

  for (const key of directAmountKeys) {
    const value = asNumber(record[key]);
    if (value !== null) {
      return formatCurrency(value);
    }
  }

  for (const key of centsAmountKeys) {
    const value = asNumber(record[key]);
    if (value !== null) {
      return formatCurrency(value / 100);
    }
  }

  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const row = item as Record<string, unknown>;
    const itemAmount =
      asNumber(row.amount) ??
      asNumber(row.subtotal) ??
      asNumber(row.price) ??
      asNumber(row.total);
    if (itemAmount !== null) {
      return formatCurrency(itemAmount);
    }
  }

  return "-";
}

function getTypeChipClass(type?: string) {
  switch (type) {
    case "purchase_item":
      return "admin-order-chip admin-order-chip--purchase";
    case "subscription":
      return "admin-order-chip admin-order-chip--subscription";
    case "mint":
      return "admin-order-chip admin-order-chip--mint";
    default:
      return "admin-order-chip";
  }
}

function getStatusChipClass(status?: string) {
  switch (status?.toLowerCase()) {
    case "paid":
      return "admin-order-chip admin-order-chip--paid";
    case "pending":
      return "admin-order-chip admin-order-chip--pending";
    case "failed":
      return "admin-order-chip admin-order-chip--failed";
    case "refunded":
      return "admin-order-chip admin-order-chip--refunded";
    default:
      return "admin-order-chip";
  }
}

const DEFAULT_PAGE_SIZE = 25;

const ACTIVE_STAGES = ["pending", "preparing", "on_hold"];

const ORDER_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: "All types", value: "" },
  { label: "Purchase item", value: "purchase_item" },
  { label: "Subscription", value: "subscription" },
  { label: "Mint", value: "mint" },
];

type ViewMode = "active" | "all";

function OrderRow({ order }: { order: AdminOrderRecord }) {
  return (
    <tr>
      <td>
        <Link
          className="admin-copy-chip"
          to={`/app/admin/orders/${order.id}`}
          state={{ order }}
          title="Open order details"
        >
          {shortId(order.id)}
          <span className="admin-copy-chip__icon">↗</span>
        </Link>
      </td>
      <td>
        <span className={getTypeChipClass(order.order_type)}>
          {order.order_type?.replace(/_/g, " ") ?? "-"}
        </span>
      </td>
      <td>
        <span className={getStatusChipClass(order.status)}>
          {order.status ?? "-"}
        </span>
      </td>
      <td>{getOrderAmount(order)}</td>
      <td style={{ fontSize: "0.82rem" }}>{formatDate(order.create_time)}</td>
      <td>
        <span className={stageBadgeClass(order.fulfillment_stage)}>
          {order.fulfillment_stage?.replace(/_/g, " ") ?? "-"}
        </span>
      </td>
    </tr>
  );
}

export default function AdminOrdersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [orderType, setOrderType] = useState("");
  const [fulfillmentStage, setFulfillmentStage] = useState("");
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");
  const [page, setPage] = useState(1);

  // When switching view modes, reset the stage filter if it's no longer valid
  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setPage(1);
    if (
      mode === "active" &&
      fulfillmentStage &&
      !ACTIVE_STAGES.includes(fulfillmentStage)
    ) {
      setFulfillmentStage("");
    }
  }

  function handleStageChip(stage: string) {
    setFulfillmentStage((current) => (current === stage ? "" : stage));
    setPage(1);
  }

  const effectiveStage = fulfillmentStage || undefined;

  const filters = useMemo(
    () => ({
      userID: userIdFilter.trim() || undefined,
      orderType: orderType || undefined,
      fulfillmentStage: effectiveStage,
      createdAfter: createdAfter || undefined,
      createdBefore: createdBefore || undefined,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    [
      userIdFilter,
      orderType,
      effectiveStage,
      createdAfter,
      createdBefore,
      page,
    ],
  );

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", filters],
    queryFn: () => getAdminOrders(filters),
    placeholderData: (previous) => previous,
  });

  const allRows = ordersQuery.data?.orders ?? [];
  // In "active" view (no specific stage filter), exclude terminal stages client-side
  const rows =
    viewMode === "active" && !fulfillmentStage
      ? allRows.filter((o) => ACTIVE_STAGES.includes(o.fulfillment_stage ?? ""))
      : allRows;
  const hasNextPage = allRows.length >= DEFAULT_PAGE_SIZE;

  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Fulfillment Orders</h1>
          <p className="content-hero-copy">
            Monitor and advance the fulfillment stage of active orders.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/admin">
          Back to Admin
        </Link>
      </section>

      <div className="adminTab-bar">
        <button
          type="button"
          className={`adminTab-btn${viewMode === "active" ? " adminTab-btn--active" : ""}`}
          onClick={() => handleViewModeChange("active")}
        >
          Active Queue
        </button>
        <button
          type="button"
          className={`adminTab-btn${viewMode === "all" ? " adminTab-btn--active" : ""}`}
          onClick={() => handleViewModeChange("all")}
        >
          All Orders
        </button>
      </div>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Filters</h2>
        </div>

        <div className="admin-orders-filter-grid">
          <label>
            <span>User ID</span>
            <input
              value={userIdFilter}
              onChange={(event) => {
                setUserIdFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Filter by user ID"
            />
          </label>

          <label>
            <span>Order Type</span>
            <select
              value={orderType}
              onChange={(event) => {
                setOrderType(event.target.value);
                setPage(1);
              }}
            >
              {ORDER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Created After</span>
            <input
              type="datetime-local"
              value={createdAfter}
              onChange={(event) => {
                setCreatedAfter(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <label>
            <span>Created Before</span>
            <input
              type="datetime-local"
              value={createdBefore}
              onChange={(event) => {
                setCreatedBefore(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <div className="admin-orders-stage-chips">
          <span className="admin-orders-stage-chips__label">Stage:</span>
          {(viewMode === "active"
            ? [
                { label: "All active", value: "" },
                { label: "Pending", value: "pending" },
                { label: "Preparing", value: "preparing" },
                { label: "On Hold", value: "on_hold" },
              ]
            : [
                { label: "All", value: "" },
                { label: "Pending", value: "pending" },
                { label: "Preparing", value: "preparing" },
                { label: "On Hold", value: "on_hold" },
                { label: "Complete", value: "complete" },
                { label: "Cancelled", value: "cancelled" },
              ]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`admin-stage-chip${fulfillmentStage === opt.value ? " admin-stage-chip--active" : ""}${opt.value ? ` admin-stage-chip--${opt.value.replace("_", "-")}` : ""}`}
              onClick={() => handleStageChip(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">
            {viewMode === "active" ? "Active Queue" : "All Orders"}
          </h2>
          <span className="meta-pill">Page {page}</span>
        </div>

        {ordersQuery.isLoading ? (
          <p className="dash-loading">Loading orders...</p>
        ) : null}

        {ordersQuery.isError ? (
          <p className="alert-error">Failed to load orders. Try again.</p>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.isError && rows.length === 0 ? (
          <div className="dash-empty">
            <p>No orders found for the current filters.</p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Created</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="admin-pagination">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || ordersQuery.isFetching}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNextPage || ordersQuery.isFetching}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
