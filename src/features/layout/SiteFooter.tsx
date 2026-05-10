import { Link } from "react-router-dom";

const legalLinks = [
  { label: "Legal Documents", href: "/legal" },
  { label: "Contact Us", href: "/contactus" },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="site-footer__mark" aria-hidden="true">
        <img src="/favicon.png" alt="" className="site-footer__mark-image" />
      </div>
      <div className="site-footer__content">
        <nav className="site-footer__links" aria-label="Legal links">
          {legalLinks.map((link) => (
            <Link key={link.label} to={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="site-footer__copy">
          © {new Date().getFullYear()} Legendary Profiles
        </p>
      </div>
    </footer>
  );
}
