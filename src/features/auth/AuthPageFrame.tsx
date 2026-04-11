import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type AuthPageFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function AuthPageFrame({
  eyebrow,
  title,
  description,
  children,
}: AuthPageFrameProps) {
  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <section className="auth-intro reveal rise-1">
          <Link className="auth-brand" to="/">
            Legendary Profiles
          </Link>
          <p className="auth-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-intro-copy">{description}</p>
          <div className="auth-highlight-list" aria-label="Product highlights">
            <span>Create Your Card</span>
            <span>Collect Cards from Others</span>
            <span>Compete in Legendary Challenges</span>
          </div>
        </section>

        <section className="auth-card auth-card-form reveal rise-2">
          {children}
        </section>
      </div>
    </main>
  );
}
