import { Link } from "react-router-dom";
import { LEGAL_DOCUMENTS } from "../legal-documents";

function firstMeaningfulLine(markdown: string) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return lines[0] ?? "Read this policy for complete details.";
}

export default function LegalOverviewPage() {
  const legalDocuments = [
    LEGAL_DOCUMENTS.terms,
    LEGAL_DOCUMENTS.privacy,
    LEGAL_DOCUMENTS.refund,
    LEGAL_DOCUMENTS.subscription,
    LEGAL_DOCUMENTS.usercontent,
  ];

  const documentIcons: Record<(typeof legalDocuments)[number]["id"], string> = {
    terms: "⚖",
    privacy: "🔒",
    refund: "💳",
    subscription: "⭐",
    usercontent: "🖼",
  };

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
          className="legal-doc-card"
          aria-label="Legal documents summary"
        >
          <div className="legal-summary-header">
            <h1>Legal Documents</h1>
            <p>
              Review the policies that govern your use of Legendary Profiles.
            </p>
          </div>

          <div className="legal-summary-grid">
            {legalDocuments.map((document) => (
              <article key={document.id} className="legal-summary-item">
                <div className="legal-summary-item__icon" aria-hidden="true">
                  {documentIcons[document.id]}
                </div>
                <div className="legal-summary-item__content">
                  <h2>
                    <Link to={`/legal/${document.id}`}>{document.title}</Link>
                  </h2>
                  <p>{firstMeaningfulLine(document.markdown)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
