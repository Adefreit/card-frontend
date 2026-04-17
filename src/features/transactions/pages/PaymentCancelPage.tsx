import { Link } from "react-router-dom";

export default function PaymentCancelPage() {
  return (
    <div className="page-stack">
      <section className="content-hero">
        <div>
          <h1>Payment canceled</h1>
          <p className="content-hero-copy">
            No charge was made. You can return to your dashboard and try again
            any time.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/dashboard">
          Back to Dashboard
        </Link>
      </section>
    </div>
  );
}
