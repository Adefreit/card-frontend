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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

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

function AddToHomeSheet({
  onClose,
  onCopyLink,
  didCopyLink,
  isIos,
}: {
  onClose: () => void;
  onCopyLink: () => void;
  didCopyLink: boolean;
  isIos: boolean;
}) {
  return (
    <div className="cardviewer-sheet" onClick={onClose}>
      <section
        className="cardviewer-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add this card to your home screen"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cardviewer-sheet__header">
          <div className="cardviewer-sheet__copy">
            <p>Add to Home Screen</p>
          </div>
          <button
            type="button"
            className="cardviewer-sheet__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="cardviewer-sheet__body">
          <ol className="cardviewer-install-sheet__steps">
            <li>
              Open your browser menu
              {isIos ? " or Share sheet" : ""}.
            </li>
            <li>
              Tap
              {isIos
                ? " Add to Home Screen."
                : " Install app or Add to Home Screen."}
            </li>
            <li>Name the shortcut and confirm Add.</li>
          </ol>

          <p className="cardviewer-install-sheet__hint">
            This creates a quick-launch icon for the card you are currently
            viewing.
          </p>

          <div className="cardviewer-panel__toolbar cardviewer-panel__toolbar--end">
            <button
              type="button"
              className="cardviewer-action-button cardviewer-action-button--compact"
              onClick={onCopyLink}
            >
              {didCopyLink ? "Link Copied" : "Copy Card Link"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CardViewerPage() {
  const { id } = useParams();
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const defaultManifestHrefRef = useRef<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [cardRotationDeg, setCardRotationDeg] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [isInstallSheetOpen, setIsInstallSheetOpen] = useState(false);
  const [didCopyCardLink, setDidCopyCardLink] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIosDevice] = useState(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  });

  const isFlipped = Math.abs(Math.round(cardRotationDeg / 180)) % 2 === 1;

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
    if (typeof document === "undefined") {
      return undefined;
    }

    const manifestLink = document.getElementById("app-manifest");
    if (!(manifestLink instanceof HTMLLinkElement)) {
      return undefined;
    }

    if (!defaultManifestHrefRef.current) {
      defaultManifestHrefRef.current = manifestLink.href;
    }

    const cardId = id?.trim();
    if (!cardId) {
      return undefined;
    }

    const normalizedCardRoute = `/cardviewer/${encodeURIComponent(cardId)}`;
    const cardLabel = (card?.data?.title || viewerName || "Card").trim();
    const shortSuffix = cardId.slice(0, 6).toUpperCase();

    const dynamicManifest = {
      id: normalizedCardRoute,
      name: `${cardLabel} | Legendary Profiles`,
      short_name: `Card ${shortSuffix}`,
      description:
        "Digital profile cards you can launch from your home screen.",
      start_url: normalizedCardRoute,
      scope: "/",
      display: "standalone",
      background_color: "#0b121b",
      theme_color: "#0b121b",
      icons: [
        {
          src: "/pwa-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/pwa-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    };

    const manifestBlob = new Blob([JSON.stringify(dynamicManifest)], {
      type: "application/manifest+json",
    });
    const dynamicManifestHref = URL.createObjectURL(manifestBlob);

    manifestLink.href = dynamicManifestHref;

    return () => {
      URL.revokeObjectURL(dynamicManifestHref);
      if (defaultManifestHrefRef.current) {
        manifestLink.href = defaultManifestHrefRef.current;
      }
    };
  }, [id, card?.data?.title, viewerName]);

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
    if (!isMenuOpen && !isContactSheetOpen && !isInstallSheetOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsContactSheetOpen(false);
        setIsInstallSheetOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, isContactSheetOpen, isInstallSheetOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };
    const displayModeMediaQuery = window.matchMedia(
      "(display-mode: standalone)",
    );
    const isStandalone =
      displayModeMediaQuery.matches ||
      navigatorWithStandalone.standalone === true;

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredInstallPrompt(installEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);

      // In standalone mode, prompt is no longer useful; keep guidance sheet available.
      if (isStandalone) {
        setIsInstallSheetOpen(false);
      }
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!card) {
      return;
    }

    // Reset UI state when card changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardRotationDeg(0);

    setIsMenuOpen(false);

    setIsContactSheetOpen(false);

    setIsInstallSheetOpen(false);

    setDidCopyCardLink(false);
  }, [card]);

  function flipBy(direction: "left" | "right") {
    const delta = direction === "right" ? 180 : -180;
    setCardRotationDeg((current) => current + delta);
    setIsMenuOpen(false);
  }

  function flipToFront(preferredDirection: "left" | "right") {
    if (!isFlipped) {
      setIsMenuOpen(false);
      return;
    }

    flipBy(preferredDirection);
  }

  function flipToBack(preferredDirection: "left" | "right") {
    if (isFlipped) {
      setIsMenuOpen(false);
      return;
    }

    flipBy(preferredDirection);
  }

  function handleFlipAction() {
    if (isFlipped) {
      flipToFront("right");
      return;
    }

    flipToBack("right");
  }

  function handleDirectionalSwipe(direction: "left" | "right") {
    flipBy(direction);
    setIsMenuOpen(false);
  }

  function handleOpenContactSheet() {
    setIsMenuOpen(false);
    setIsContactSheetOpen(true);
  }

  async function handleCopyCardLink() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setDidCopyCardLink(true);
      window.setTimeout(() => setDidCopyCardLink(false), 1400);
    } catch {
      setDidCopyCardLink(false);
    }
  }

  async function handleAddToHomeScreen() {
    setIsMenuOpen(false);

    if (!deferredInstallPrompt) {
      setIsInstallSheetOpen(true);
      return;
    }

    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setDeferredInstallPrompt(null);
      } else {
        setIsInstallSheetOpen(true);
      }
    } catch {
      setIsInstallSheetOpen(true);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

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

    handleDirectionalSwipe(deltaX > 0 ? "right" : "left");
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleDirectionalSwipe("right");
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
                className="cardviewer-card-trigger"
                role="button"
                tabIndex={0}
                onKeyDown={handleCardKeyDown}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                aria-pressed={isFlipped}
                aria-label="Swipe left or right to flip card"
              >
                <div
                  className="cardviewer-card"
                  style={{ transform: `rotateY(${cardRotationDeg}deg)` }}
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
                    onClick={handleFlipAction}
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
                    onClick={handleAddToHomeScreen}
                  >
                    Add to Home Screen
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

            {isInstallSheetOpen ? (
              <AddToHomeSheet
                onClose={() => setIsInstallSheetOpen(false)}
                onCopyLink={handleCopyCardLink}
                didCopyLink={didCopyCardLink}
                isIos={isIosDevice}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
