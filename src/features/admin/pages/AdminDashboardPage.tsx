import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAdminHealth } from "../api";

function formatDate(value?: string) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return parsed.toLocaleString();
}

export default function AdminDashboardPage() {
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: getAdminHealth,
    retry: 1,
  });

  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Admin Console</h1>
          <p className="content-hero-copy">
            Manage users, permissions, and card operations from one workspace.
          </p>
        </div>
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">API Health</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => healthQuery.refetch()}
            disabled={healthQuery.isFetching}
          >
            {healthQuery.isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {healthQuery.isLoading ? (
          <p className="dash-loading">Checking admin API status...</p>
        ) : null}

        {healthQuery.isError ? (
          <p className="alert-error">
            Unable to reach admin API right now. Please try again.
          </p>
        ) : null}

        {healthQuery.data ? (
          <div className="detail-meta-grid">
            <div className="detail-meta-item">
              <span>Status</span>
              <strong>{healthQuery.data.response}</strong>
            </div>
            <div className="detail-meta-item">
              <span>Timestamp</span>
              <strong>{formatDate(healthQuery.data.timestamp)}</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Quick Actions</h2>
          <span className="meta-pill">Navigation</span>
        </div>
        <div className="admin-actions-list">
          <Link className="admin-actions-row" to="/app/admin/users">
            <span className="admin-actions-row__title">Manage Users</span>
            <span className="admin-actions-row__desc">
              Search members, edit permissions, adjust subscriptions, and manage
              cards.
            </span>
          </Link>
          <Link className="admin-actions-row" to="/app/admin/orders">
            <span className="admin-actions-row__title">Fulfillment Orders</span>
            <span className="admin-actions-row__desc">
              Track order progress, review order details, and advance
              fulfillment stages.
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
