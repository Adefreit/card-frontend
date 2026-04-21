import { Link } from "react-router-dom";

export default function PaymentCancelPage() {
  return (
    <div className="page-stack payment-success-page">
      <section className="content-hero payment-success-hero">
        <div>
          <h1>Legendary Profiles</h1>
          <p className="content-hero-copy">Payment Cancelled</p>
        </div>
      </section>

      <section className="content-card payment-receipt-card">
        <div className="content-card-header row-between">
          <div>
            <h2>Transaction not completed</h2>
            <p>
              The checkout was canceled or encountered an error before payment
              was finalized. No new purchase has been applied to your account.
            </p>
          </div>
        </div>

        <div className="payment-success-actions payment-success-actions--bottom">
          <Link className="btn-primary payment-success-btn" to="/app/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
