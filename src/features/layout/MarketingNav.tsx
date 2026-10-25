import { Link } from "react-router-dom";

export default function MarketingNav() {
  return (
    <header className="lp-nav">
      <Link className="lp-brand" to="/">
        <span className="lp-brand-mark" aria-hidden="true">
          <img className="lp-brand-mark__image" src="/favicon.png" alt="" />
        </span>
        <span>Legendary Profiles</span>
      </Link>
      <div className="lp-nav-ctas">
        <Link className="lp-nav-link" to="/blog">
          Blog
        </Link>
        <Link className="lp-nav-link" to="/login">
          Sign in
        </Link>
        <Link className="lp-nav-link" to="/register">
          Register
        </Link>
      </div>
    </header>
  );
}
