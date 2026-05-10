import { Link, useParams } from "react-router-dom";
import MarkdownRenderer from "../../../components/MarkdownRenderer";
import {
  LEGAL_DOCUMENTS,
  type LegalDocumentId,
} from "../legal-documents";

function isLegalDocumentId(value: string): value is LegalDocumentId {
  return value in LEGAL_DOCUMENTS;
}

export default function LegalDocumentPage() {
  const { documentId = "" } = useParams();
  const document = isLegalDocumentId(documentId)
    ? LEGAL_DOCUMENTS[documentId]
    : null;

  if (!document) {
    return (
      <div className="legal-doc-page">
        <header className="legal-doc-header">
          <Link className="legal-doc-brand" to="/">
            <img src="/favicon.png" alt="" aria-hidden="true" />
            <span>Legendary Profiles</span>
          </Link>
        </header>
        <main className="legal-doc-main">
          <section className="legal-doc-card">
            <h1>Document not found</h1>
            <p>The requested legal document could not be located.</p>
            <p>
              <Link to="/">Return home</Link>
            </p>
          </section>
        </main>
      </div>
    );
  }

  const content = document.markdown.trim() || "_This document will be published soon._";

  return (
    <div className="legal-doc-page">
      <header className="legal-doc-header">
        <Link className="legal-doc-brand" to="/">
          <img src="/favicon.png" alt="" aria-hidden="true" />
          <span>Legendary Profiles</span>
        </Link>
      </header>
      <main className="legal-doc-main">
        <article className="legal-doc-card" aria-label={document.title}>
          <MarkdownRenderer content={content} className="legal-doc-markdown" />
        </article>
      </main>
    </div>
  );
}
