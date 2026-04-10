import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  downloadPublicCardVcard,
  getCard,
  type CardContactInfo,
  type CardRecord,
  type CardNamedUrl,
} from "../api";

const CARDVIEWER_PANELS = ["Card", "Contact", "Links"] as const;

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

function getViewerAddress(contactInfo?: CardContactInfo) {
  const address = contactInfo?.address;
  if (!address) {
    return "";
  }

  return [
    [address.street1, address.street2].filter(Boolean).join(", "),
    [address.city, address.region, address.postalCode]
      .filter(Boolean)
      .join(", "),
    address.country,
  ]
    .filter(Boolean)
    .join("\n");
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

function ContactBlock({
  card,
  onDownloadVcard,
  isDownloadingVcard,
}: {
  card: CardRecord;
  onDownloadVcard: () => void;
  isDownloadingVcard: boolean;
}) {
  const contactInfo = card.data.contactInfo;
  const fullName = getViewerName(contactInfo);
  const addressText = getViewerAddress(contactInfo);
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
    addressText ? { label: "Address", value: addressText } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string }>;

  if (!fullName && contactRows.length === 0 && socialLinks.length === 0) {
    return (
      <section className="cardviewer-slide cardviewer-slide--contact">
        <div className="cardviewer-slide__body cardviewer-slide__body--centered">
          <div className="cardviewer-panel__toolbar cardviewer-panel__toolbar--stacked">
            <div className="cardviewer-panel__header">
              <h2>Contact Information</h2>
              <p>No contact information has been added to this card yet.</p>
            </div>
            <button
              type="button"
              className="cardviewer-action-button cardviewer-action-button--compact"
              onClick={onDownloadVcard}
              disabled={isDownloadingVcard}
            >
              {isDownloadingVcard ? "Preparing vCard..." : "Download vCard"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cardviewer-slide cardviewer-slide--contact">
      <div className="cardviewer-slide__body">
        <div className="cardviewer-panel__toolbar">
          <div className="cardviewer-panel__header">
            <h2>Contact Information</h2>
            <button
              type="button"
              className="cardviewer-action-button cardviewer-action-button--compact"
              onClick={onDownloadVcard}
              disabled={isDownloadingVcard}
            >
              {isDownloadingVcard
                ? "Downloading Contact..."
                : "Add to Contacts"}
            </button>
          </div>
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
                <span className="cardviewer-contact-value cardviewer-contact-value--multiline">
                  {row.value}
                </span>
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
      </div>
    </section>
  );
}

export default function CardViewerPage() {
  const { id } = useParams();
  const swimlaneRef = useRef<HTMLElement | null>(null);
  const [activePanelIndex, setActivePanelIndex] = useState(0);

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

  useEffect(() => {
    const swimlane = swimlaneRef.current;
    if (!swimlane || !card) {
      return undefined;
    }

    const slides = Array.from(swimlane.children) as HTMLElement[];
    if (slides.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) {
          return;
        }

        const mostVisibleEntry = visibleEntries.reduce((current, candidate) => {
          return candidate.intersectionRatio > current.intersectionRatio
            ? candidate
            : current;
        });

        const nextIndex = slides.indexOf(
          mostVisibleEntry.target as HTMLElement,
        );
        if (nextIndex >= 0) {
          setActivePanelIndex(nextIndex);
        }
      },
      {
        root: swimlane,
        threshold: [0.55, 0.7, 0.9],
      },
    );

    slides.forEach((slide) => observer.observe(slide));

    return () => {
      observer.disconnect();
    };
  }, [card]);

  return (
    <div className="cardviewer-page">
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
            <div
              className="cardviewer-page-indicator"
              aria-label={`Page ${activePanelIndex + 1} of ${CARDVIEWER_PANELS.length}`}
              aria-live="polite"
            >
              <a
                className="cardviewer-page-indicator__brand"
                href="https://legendaryprofiles.com"
                target="_blank"
                rel="noreferrer"
              >
                Legendary Profiles
              </a>
              <div
                className="cardviewer-page-indicator__track"
                aria-hidden="true"
              >
                {CARDVIEWER_PANELS.map((panel, index) => (
                  <span
                    key={panel}
                    className={`cardviewer-page-indicator__segment${activePanelIndex === index ? " is-active" : ""}`}
                  />
                ))}
              </div>
            </div>

            <section
              ref={swimlaneRef}
              className="cardviewer-swimlane"
              aria-label="Card viewer panels"
            >
              <section className="cardviewer-slide cardviewer-slide--main">
                <div className="cardviewer-slide__body cardviewer-slide__body--main">
                  <div className="cardviewer-art">
                    {previewUrl ? (
                      <img
                        className="cardviewer-image"
                        src={previewUrl}
                        alt={
                          card.data.title ||
                          viewerName ||
                          "Legendary profile card"
                        }
                      />
                    ) : (
                      <div className="cardviewer-image cardviewer-image--placeholder">
                        Preview unavailable
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <ContactBlock
                card={card}
                onDownloadVcard={() => vcardMutation.mutate(card.id)}
                isDownloadingVcard={vcardMutation.isPending}
              />

              <section className="cardviewer-slide cardviewer-slide--premium">
                <div className="cardviewer-slide__body">
                  <div className="cardviewer-panel__header">
                    <h2>Premium URLs</h2>
                    <p>Open featured links associated with this profile.</p>
                  </div>

                  {premiumLinks.length > 0 ? (
                    <div className="cardviewer-links cardviewer-links--stacked">
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
                  ) : (
                    <div className="cardviewer-empty-state">
                      No premium links are available for this card.
                    </div>
                  )}
                </div>
              </section>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
