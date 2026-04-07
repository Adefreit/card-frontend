import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  downloadPublicCardVcard,
  getCard,
  type CardContactInfo,
  type CardRecord,
  type CardNamedUrl,
} from "../api";

function getViewerName(contactInfo?: CardContactInfo) {
  const fullName = [contactInfo?.firstName, contactInfo?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName;
}

function getViewerPreviewUrl(card?: CardRecord) {
  return card?.last_render || "";
}

function getViewerPremiumLinks(card?: CardRecord): CardNamedUrl[] {
  return card?.data.premium?.urlList || [];
}

function slugifyFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "legendary-profile"
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function ContactBlock({ card }: { card: CardRecord }) {
  const contactInfo = card.data.contactInfo;
  const fullName = getViewerName(contactInfo);
  const socialLinks = Object.entries(contactInfo?.socialAccounts || {});
  const contactRows = [
    contactInfo?.jobTitle
      ? { label: "Title", value: contactInfo.jobTitle }
      : null,
    contactInfo?.organization
      ? { label: "Company", value: contactInfo.organization }
      : null,
    contactInfo?.workEmail
      ? {
          label: "Email",
          value: contactInfo.workEmail,
          href: `mailto:${contactInfo.workEmail}`,
        }
      : contactInfo?.personalEmail
        ? {
            label: "Email",
            value: contactInfo.personalEmail,
            href: `mailto:${contactInfo.personalEmail}`,
          }
        : null,
    contactInfo?.cellPhone
      ? {
          label: "Phone",
          value: contactInfo.cellPhone,
          href: `tel:${contactInfo.cellPhone}`,
        }
      : contactInfo?.homePhone
        ? {
            label: "Phone",
            value: contactInfo.homePhone,
            href: `tel:${contactInfo.homePhone}`,
          }
        : null,
    contactInfo?.website
      ? {
          label: "Website",
          value: contactInfo.website,
          href: contactInfo.website,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string }>;

  if (!fullName && contactRows.length === 0 && socialLinks.length === 0) {
    return null;
  }

  return (
    <section className="cardviewer-panel">
      <div className="cardviewer-panel__header">
        <h2>Contact Information</h2>
        <p>Details available on this Legendary Profile card.</p>
      </div>

      <div className="cardviewer-contact-list">
        {fullName ? (
          <div className="cardviewer-contact-row">
            <span className="cardviewer-contact-label">Name</span>
            <span className="cardviewer-contact-value">{fullName}</span>
          </div>
        ) : null}

        {contactRows.map((row) => (
          <div
            key={`${row.label}:${row.value}`}
            className="cardviewer-contact-row"
          >
            <span className="cardviewer-contact-label">{row.label}</span>
            {row.href ? (
              <a
                className="cardviewer-contact-link"
                href={row.href}
                target={row.href.startsWith("http") ? "_blank" : undefined}
                rel={row.href.startsWith("http") ? "noreferrer" : undefined}
              >
                {row.value}
              </a>
            ) : (
              <span className="cardviewer-contact-value">{row.value}</span>
            )}
          </div>
        ))}
      </div>

      {socialLinks.length > 0 ? (
        <div className="cardviewer-socials">
          <h3>Social Links</h3>
          <div className="cardviewer-socials__list">
            {socialLinks.map(([platform, url]) => (
              <a
                key={platform}
                className="cardviewer-socials__chip"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {platform}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function CardViewerPage() {
  const { id } = useParams();

  const cardQuery = useQuery({
    queryKey: ["public-card-viewer", id],
    queryFn: () => getCard(id as string),
    enabled: Boolean(id),
  });

  const vcardMutation = useMutation({
    mutationFn: downloadPublicCardVcard,
    onSuccess: (blob) => {
      const card = cardQuery.data;
      const fileStem = slugifyFileName(
        getViewerName(card?.data.contactInfo) ||
          card?.data.title ||
          "legendary-profile",
      );
      downloadBlob(blob, `${fileStem}.vcf`);
    },
  });

  const card = cardQuery.data;
  const previewUrl = getViewerPreviewUrl(card);
  const premiumLinks = getViewerPremiumLinks(card);
  const viewerName = getViewerName(card?.data.contactInfo);

  return (
    <div className="cardviewer-page">
      <header className="cardviewer-header">
        <Link className="cardviewer-backlink" to="/">
          Legendary Profiles
        </Link>
      </header>

      <main className="cardviewer-shell">
        {cardQuery.isLoading ? (
          <section className="cardviewer-status cardviewer-status--loading">
            <h1>Loading card</h1>
            <p>Fetching the latest viewer details.</p>
          </section>
        ) : null}

        {cardQuery.isError ? (
          <section className="cardviewer-status cardviewer-status--error">
            <h1>Card not found</h1>
            <p>The requested card viewer could not be loaded.</p>
          </section>
        ) : null}

        {card ? (
          <>
            <section className="cardviewer-hero">
              <div className="cardviewer-copy">
                <span className="cardviewer-kicker">Legendary Profiles</span>
                <h1>{viewerName || card.data.title || "Profile Card"}</h1>
                {card.data.contactInfo?.jobTitle ||
                card.data.contactInfo?.organization ? (
                  <p className="cardviewer-subtitle">
                    {[
                      card.data.contactInfo?.jobTitle,
                      card.data.contactInfo?.organization,
                    ]
                      .filter(Boolean)
                      .join(" at ")}
                  </p>
                ) : card.data.subtitle ? (
                  <p className="cardviewer-subtitle">{card.data.subtitle}</p>
                ) : null}
                <p className="cardviewer-description">
                  View card details, open premium links, or download the vCard.
                </p>
              </div>

              <div className="cardviewer-art">
                {previewUrl ? (
                  <img
                    className="cardviewer-image"
                    src={previewUrl}
                    alt={
                      card.data.title || viewerName || "Legendary profile card"
                    }
                  />
                ) : (
                  <div className="cardviewer-image cardviewer-image--placeholder">
                    Preview unavailable
                  </div>
                )}
              </div>
            </section>

            <section className="cardviewer-content">
              <ContactBlock card={card} />

              {premiumLinks.length > 0 ? (
                <section className="cardviewer-panel">
                  <div className="cardviewer-panel__header">
                    <h2>Premium Links</h2>
                    <p>Open featured links associated with this profile.</p>
                  </div>

                  <div className="cardviewer-links">
                    {premiumLinks.map((link) => (
                      <a
                        key={`${link.name}:${link.url}`}
                        className="cardviewer-link-button"
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.name}
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </section>
          </>
        ) : null}
      </main>

      {card ? (
        <div className="cardviewer-vcard-bar">
          <button
            type="button"
            className="cardviewer-vcard-button"
            onClick={() => vcardMutation.mutate(card.id)}
            disabled={vcardMutation.isPending}
          >
            {vcardMutation.isPending ? "Preparing vCard..." : "Download vCard"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
