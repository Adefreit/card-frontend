import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="marketing-page">
      <div className="page-orb page-orb-left" aria-hidden="true"></div>
      <div className="page-orb page-orb-right" aria-hidden="true"></div>
      <header className="marketing-nav reveal rise-1">
        <div className="marketing-brand">Legendary Profiles</div>
        <nav className="marketing-nav-links" aria-label="Public navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#faq">FAQ</a>
          <Link className="btn-ghost" to="/login">
            Sign in
          </Link>
          <Link className="btn-primary" to="/register">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero-grid">
          <div className="hero-copy reveal rise-1">
            <p className="eyebrow">Fun-first digital business cards</p>
            <h1>Make every business card feel memorable and legendary.</h1>
            <p className="hero-subcopy">
              Legendary Profiles helps you design playful, personality-packed
              profiles that still look professional and polished. Give people a
              reason to remember you after the handshake.
            </p>
            <div className="hero-ctas">
              <Link className="btn-primary btn-lg" to="/register">
                Start your profile
              </Link>
              <Link className="btn-ghost btn-lg" to="/login">
                Sign in
              </Link>
            </div>
            <p className="trust-note">
              No credit card required. Your first profile can be live in
              minutes.
            </p>
            <div className="hero-tags" aria-label="Product highlights">
              <span>Playful by design</span>
              <span>Business-ready layouts</span>
              <span>Share anywhere</span>
            </div>
          </div>

          <aside
            className="hero-panel reveal rise-2"
            aria-label="Product highlights"
          >
            <div className="profile-preview">
              <div className="profile-preview-card">
                <div className="profile-avatar" aria-hidden="true">
                  LP
                </div>
                <div className="profile-identity">
                  <strong>Legendary Profile</strong>
                  <span>Digital card preview</span>
                </div>
                <div className="profile-pill">Live</div>
                <div className="profile-banner">
                  <p className="profile-name">Jordan Hale</p>
                  <p className="profile-role">Brand Strategist and Connector</p>
                  <div className="profile-chips">
                    <span>Story-driven</span>
                    <span>Warm intro</span>
                    <span>Book a call</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="metric-strip">
              <div>
                <span>Profiles created</span>
                <strong>125K+</strong>
              </div>
              <div>
                <span>Avg. setup time</span>
                <strong>-41%</strong>
              </div>
            </div>
            <div className="panel-card">
              <p className="panel-title">Latest updates</p>
              <ul>
                <li>
                  <span className="dot"></span>
                  New profile theme published
                </li>
                <li>
                  <span className="dot"></span>8 style blocks added to your card
                </li>
                <li>
                  <span className="dot"></span>
                  Team review completed in 13 minutes
                </li>
              </ul>
            </div>
          </aside>
        </section>

        <section id="features" className="marketing-section reveal rise-2">
          <div className="section-heading">
            <p className="section-kicker">Why it feels different</p>
            <h2>Everything you need to create standout card profiles</h2>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <span>✦</span>
              </div>
              <h3>Playful profile builder</h3>
              <p>
                Mix colors, personality prompts, links, and media into a card
                profile that actually reflects who you are.
              </p>
            </article>
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <span>◇</span>
              </div>
              <h3>Professional polish built in</h3>
              <p>
                Keep layouts clean and readable while still adding fun elements
                that help people remember your name.
              </p>
            </article>
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <span>↗</span>
              </div>
              <h3>Fast sharing flow</h3>
              <p>
                Go from idea to live profile quickly, then share your card
                profile link anywhere you network.
              </p>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="marketing-section reveal rise-3">
          <div className="section-heading">
            <p className="section-kicker">Simple setup</p>
            <h2>How it works</h2>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <span>01</span>
              <h3>Create your legendary profile</h3>
              <p>
                Start with a template or build from scratch with personality,
                branding, and your best contact moments.
              </p>
            </article>
            <article className="step-card">
              <span>02</span>
              <h3>Customize your style</h3>
              <p>
                Pick colors, sections, and visual accents that feel fun while
                still staying sharp for business use.
              </p>
            </article>
            <article className="step-card">
              <span>03</span>
              <h3>Share and stand out</h3>
              <p>
                Publish and share your profile so every intro feels more
                personal and far more memorable.
              </p>
            </article>
          </div>
        </section>

        <section id="faq" className="marketing-section reveal rise-3">
          <div className="section-heading">
            <p className="section-kicker">Good to know</p>
            <h2>Frequently asked questions</h2>
          </div>
          <div className="faq-grid">
            <article className="faq-card">
              <h3>Is Legendary Profiles only for big companies?</h3>
              <p>
                No. It is designed for solo professionals, creators, and small
                teams who want their cards to feel less generic.
              </p>
            </article>
            <article className="faq-card">
              <h3>Can I try it before committing?</h3>
              <p>
                Yes. Create an account, build your profile, and test your style
                before rolling it out broadly.
              </p>
            </article>
          </div>
        </section>

        <section className="cta-banner reveal rise-3">
          <div>
            <h2>Ready to create your Legendary Profile?</h2>
            <p>
              Launch your first profile today and make your business card feel
              as unique as you are.
            </p>
          </div>
          <Link className="btn-primary btn-lg" to="/register">
            Create free profile
          </Link>
        </section>
      </main>
    </div>
  );
}
