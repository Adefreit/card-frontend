import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Card Platform Frontend</h1>
        <p>
          React scaffold connected to your Card API authentication and card
          routes.
        </p>
        <div className="auth-links">
          <Link className="btn-secondary" to="/login">
            Sign in
          </Link>
          <Link className="btn-secondary" to="/register">
            Register
          </Link>
        </div>
      </section>
    </main>
  );
}
