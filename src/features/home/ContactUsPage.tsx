import { Link } from "react-router-dom";

export default function ContactUsPage() {
  return (
    <div className="legal-doc-page">
      <header className="legal-doc-header">
        <Link className="legal-doc-brand" to="/">
          <img src="/favicon.png" alt="" aria-hidden="true" />
          <span>Legendary Profiles</span>
        </Link>
      </header>

      <main className="legal-doc-main">
        <section
          className="legal-doc-card contact-page-card"
          aria-label="Contact information"
        >
          <h1>Contact Us</h1>
          <p>
            We are here to help with account questions, card support, and policy
            requests.
          </p>

          <div className="contact-info-grid">
            <article className="contact-info-item">
              <h2>Support Email</h2>
              <p>
                For all support and account inquiries, email us at:
                <br />
                <a href="mailto:support@legendaryprofiles.com">
                  support@legendaryprofiles.com
                </a>
              </p>
            </article>

            <article className="contact-info-item">
              <h2>Legal & Policy Questions</h2>
              <p>
                If your request is related to policy, privacy, or terms,
                reference the relevant document from our legal summary page.
              </p>
              <p>
                <Link to="/legal">Open Legal Documents</Link>
              </p>
            </article>

            <article className="contact-info-item">
              <h2>Response Time</h2>
              <p>
                We typically respond within 1-2 business days. Please include as
                much detail as possible so we can help quickly.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
