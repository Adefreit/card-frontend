import { Link } from "react-router-dom";

export default function AdminAccessDeniedPage() {
  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Access denied</h1>
          <p className="content-hero-copy">
            You do not have permission to access administrator features.
          </p>
        </div>
      </section>

      <section className="content-card admin-card">
        <p>
          Administrator tools require the ADMIN permission. If you believe this
          is an error, contact an existing administrator.
        </p>
        <div className="admin-actions">
          <Link className="btn-primary" to="/app/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
