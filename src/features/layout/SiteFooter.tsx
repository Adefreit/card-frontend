import { Link } from "react-router-dom";

const legalLinks = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Refund Policy", href: "/legal/refund" },
  { label: "Subscription Policy", href: "/legal/subscription" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "User Content Policy", href: "/legal/usercontent" },
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
          <a href="mailto:support@legendaryprofiles.com">Support</a>
        </nav>
        <p className="site-footer__copy">
          © {new Date().getFullYear()} Legendary Profiles
        </p>
      </div>
    </footer>
  );
}
