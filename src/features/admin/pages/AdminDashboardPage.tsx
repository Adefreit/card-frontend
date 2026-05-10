import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAdminHealth } from "../api";

export default function AdminDashboardPage() {
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: getAdminHealth,
    retry: 1,
  });

  const isHealthy = !healthQuery.isError;

  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Admin Console</h1>
          <p className="content-hero-copy">
            Manage users, permissions, and card operations from one workspace.
          </p>
        </div>
        <button
          type="button"
          className="admin-health-button"
          onClick={() => healthQuery.refetch()}
          disabled={healthQuery.isFetching}
          title={
            healthQuery.isError ? "API is unavailable" : "API is operational"
          }
        >
          <div
            className={`admin-health-indicator ${isHealthy ? "admin-health-indicator--healthy" : "admin-health-indicator--error"}`}
          />
          {healthQuery.isFetching ? "Checking..." : "API Status"}
        </button>
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Quick Actions</h2>
        </div>
        <div className="admin-actions-grid">
          <Link className="admin-action-card" to="/app/admin/users">
            <div className="admin-action-card__icon">👥</div>
            <div className="admin-action-card__content">
              <span className="admin-action-card__title">Manage Users</span>
              <span className="admin-action-card__desc">
                Search members, edit permissions, and manage subscriptions.
              </span>
            </div>
          </Link>
          <Link className="admin-action-card" to="/app/admin/orders">
            <div className="admin-action-card__icon">📦</div>
            <div className="admin-action-card__content">
              <span className="admin-action-card__title">
                Fulfillment Orders
              </span>
              <span className="admin-action-card__desc">
                Track progress and advance fulfillment stages.
              </span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
