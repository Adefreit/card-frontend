import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
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
  return card?.last_proof || card?.last_render || "";
}

function getViewerPremiumLinks(card?: CardRecord): CardNamedUrl[] {
  return card?.data.premium?.urlList || [];
}

function getViewerContactRows(contactInfo?: CardContactInfo) {
  const addressText = getViewerAddress(contactInfo);

  return [
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

function ViewerEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="cardviewer-empty-state">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function ContactSheet({
  card,
  onClose,
  onDownloadVcard,
  isDownloadingVcard,
}: {
  card: CardRecord;
  onClose: () => void;
  onDownloadVcard: () => void;
  isDownloadingVcard: boolean;
}) {
  const contactInfo = card.data.contactInfo;
  const fullName = getViewerName(contactInfo);
  const socialLinks = Object.entries(contactInfo?.socialAccounts || {});
  const contactRows = getViewerContactRows(contactInfo);

  return (
    <div className="cardviewer-sheet" onClick={onClose}>
      <section
        className="cardviewer-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="vCard details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cardviewer-sheet__header">
          <div className="cardviewer-sheet__copy">
            <p>{fullName || card.data.title || "Legendary Profile"}</p>
          </div>
        </div>

        <div className="cardviewer-sheet__body">
          <div className="cardviewer-panel__toolbar cardviewer-panel__toolbar--end">
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

          {!fullName && contactRows.length === 0 && socialLinks.length === 0 ? (
            <ViewerEmptyState
              title="Contact Information"
              message="No contact information has been added to this card yet."
            />
          ) : (
            <>
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
                    <span className="cardviewer-contact-label">
                      {row.label}
                    </span>
                    {row.href ? (
                      <a
                        className="cardviewer-contact-link"
                        href={row.href}
                        target={
                          row.href.startsWith("http") ? "_blank" : undefined
                        }
                        rel={
                          row.href.startsWith("http") ? "noreferrer" : undefined
                        }
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
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function CardViewerPage() {
  const { id } = useParams();
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [isSwipeCueVisible, setIsSwipeCueVisible] = useState(false);

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
  const isMintedCard = Boolean(card?.minted);
  const previewUrl = getViewerPreviewUrl(card);
  const premiumLinks = getViewerPremiumLinks(card);
  const viewerName = getViewerName(card?.data.contactInfo);

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen && !isContactSheetOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsContactSheetOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, isContactSheetOpen]);

  useEffect(() => {
    if (!card) {
      return;
    }

    setIsFlipped(false);
    setIsMenuOpen(false);
    setIsContactSheetOpen(false);
    setIsSwipeCueVisible(false);
  }, [card?.id]);

  useEffect(() => {
    if (!card || !isMintedCard || isFlipped) {
      setIsSwipeCueVisible(false);
      return undefined;
    }

    if (typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReducedMotion) {
        return undefined;
      }
    }

    setIsSwipeCueVisible(true);

    const timeoutId = window.setTimeout(() => {
      setIsSwipeCueVisible(false);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [card, isMintedCard, isFlipped]);

  function handleToggleFlip() {
    setIsSwipeCueVisible(false);
    setIsFlipped((current) => !current);
    setIsMenuOpen(false);
  }

  function handleOpenContactSheet() {
    setIsSwipeCueVisible(false);
    setIsMenuOpen(false);
    setIsContactSheetOpen(true);
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    setIsSwipeCueVisible(false);
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    const touchStart = swipeStartRef.current;

    swipeStartRef.current = null;

    if (!touch || !touchStart) {
      return;
    }

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    setIsFlipped((current) => !current);
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleToggleFlip();
  }

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

        {card && !isMintedCard ? (
          <section className="cardviewer-status cardviewer-status--error">
            <h1>Card unavailable</h1>
            <p>This card can be viewed here after it has been minted.</p>
          </section>
        ) : null}

        {card && isMintedCard ? (
          <>
            <section className="cardviewer-stage">
              <div
                className={`cardviewer-card-trigger${isSwipeCueVisible ? " is-swipe-cued" : ""}`}
                role="button"
                tabIndex={0}
                onKeyDown={handleCardKeyDown}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                aria-pressed={isFlipped}
                aria-label={
                  isFlipped
                    ? "Swipe left or right to flip card to front"
                    : "Swipe left or right to flip card to back"
                }
              >
                <div
                  className={`cardviewer-card${isFlipped ? " is-flipped" : ""}`}
                >
                  <section className="cardviewer-card__face cardviewer-card__face--front">
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

                    {isSwipeCueVisible ? (
                      <div className="cardviewer-swipe-cue" aria-hidden="true">
                        <span className="cardviewer-swipe-cue__arrows">
                          &larr; &rarr;
                        </span>
                        <span className="cardviewer-swipe-cue__text">
                          Swipe to flip
                        </span>
                      </div>
                    ) : null}
                  </section>

                  <section className="cardviewer-card__face cardviewer-card__face--back">
                    <div className="cardviewer-card__backdrop" />
                    <div className="cardviewer-card__back-content">
                      <div className="cardviewer-card__back-copy">
                        <p>{card.data.title || "Legendary Profile"}</p>
                      </div>

                      {premiumLinks.length > 0 ? (
                        <div className="cardviewer-hub-list">
                          {premiumLinks.map((link) => (
                            <a
                              key={`${link.name}:${link.url}`}
                              className="cardviewer-hub-item"
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <span className="cardviewer-hub-item__name">
                                {link.name}
                              </span>
                              <span className="cardviewer-hub-item__url">
                                {link.url}
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <ViewerEmptyState
                          title="User Hub"
                          message="No links or user hub content are available for this card yet."
                        />
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </section>

            <div
              ref={actionMenuRef}
              className={`cardviewer-fab-group${isMenuOpen ? " is-open" : ""}`}
            >
              {isMenuOpen ? (
                <div
                  className="cardviewer-fab-menu"
                  role="menu"
                  aria-label="Card viewer options"
                >
                  <div className="cardviewer-fab-menu__title">
                    <img src="/favicon.png" alt="" />
                    <span>Legendary Profiles</span>
                  </div>
                  <button
                    type="button"
                    className="cardviewer-fab-menu__item"
                    role="menuitem"
                    onClick={handleToggleFlip}
                  >
                    {isFlipped ? "View Front" : "Flip Card"}
                  </button>
                  <button
                    type="button"
                    className="cardviewer-fab-menu__item"
                    role="menuitem"
                    onClick={handleOpenContactSheet}
                  >
                    View Contact Info
                  </button>
                  <button
                    type="button"
                    className="cardviewer-fab-menu__item"
                    role="menuitem"
                    onClick={() => vcardMutation.mutate(card.id)}
                    disabled={vcardMutation.isPending}
                  >
                    {vcardMutation.isPending
                      ? "Preparing vCard..."
                      : "Add to Contacts"}
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="cardviewer-fab"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-label="Open card options"
                onClick={() => setIsMenuOpen((current) => !current)}
              >
                <img src="/favicon.png" alt="" />
              </button>
            </div>

            {isContactSheetOpen ? (
              <ContactSheet
                card={card}
                onClose={() => setIsContactSheetOpen(false)}
                onDownloadVcard={() => vcardMutation.mutate(card.id)}
                isDownloadingVcard={vcardMutation.isPending}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
