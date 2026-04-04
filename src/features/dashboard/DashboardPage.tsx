import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getCards, renderCardProof } from "../cards/api";
import { apiClient } from "../../lib/http";

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #075985 100%)",
  "linear-gradient(135deg, #14532d 0%, #15803d 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)",
  "linear-gradient(135deg, #581c87 0%, #7e22ce 100%)",
] as const;

const CARD_TINT_BORDERS = [
  "rgba(55, 48, 163, 0.34)",
  "rgba(7, 89, 133, 0.34)",
  "rgba(21, 128, 61, 0.34)",
  "rgba(194, 65, 12, 0.34)",
  "rgba(126, 34, 206, 0.34)",
] as const;

function isPremium(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

function PlanModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Draft vs. Premium</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">
          Choose the tier that fits your legend.
        </p>
        <div className="plan-compare">
          <div className="plan-col plan-col--draft">
            <div className="plan-col-header">
              <span className="plan-name">Draft</span>
              <span className="plan-price">Free</span>
            </div>
            <ul className="plan-features">
              <li className="plan-feat plan-feat--yes">
                Create / Update Cards
              </li>
              <li className="plan-feat plan-feat--no">Downloadable Proof</li>
              <li className="plan-feat plan-feat--no">Smart QR Codes</li>
              <li className="plan-feat plan-feat--no">
                Analytics &amp; Scan Tracking
              </li>
              <li className="plan-feat plan-feat--no">Link Hub Page</li>
              <li className="plan-feat plan-feat--no">Priority Support</li>
            </ul>
          </div>
          <div className="plan-col plan-col--premium">
            <div className="plan-col-header">
              <span className="plan-name">✦ Premium</span>
              <span className="plan-price">$10.00 / year</span>
            </div>
            <ul className="plan-features">
              <li className="plan-feat plan-feat--yes">
                Create / Update Cards
              </li>
              <li className="plan-feat plan-feat--yes">Downloadable Proof</li>
              <li className="plan-feat plan-feat--yes">Smart QR Codes</li>
              <li className="plan-feat plan-feat--yes">
                Analytics &amp; Scan Tracking
              </li>
              <li className="plan-feat plan-feat--yes">Link Hub Page</li>
              <li className="plan-feat plan-feat--yes">Priority Support</li>
            </ul>
          </div>
        </div>
        <div className="qr-modal-footer">
          <p
            style={{ margin: 0, fontSize: "0.9rem", color: "var(--ui-muted)" }}
          >
            💡 Ordering physical cards will automatically upgrade that card to
            Premium.
          </p>
        </div>
      </div>
    </div>
  );
}

async function fetchQrBlobUrl(cardId: string): Promise<string> {
  const { data } = await apiClient.get<Blob>(`/v1/cards/render/qr/${cardId}`, {
    params: { format: "png", dpi: 300 },
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}

interface QrModalProps {
  cardId: string;
  cardTitle: string;
  onClose: () => void;
}

function QrModal({ cardId, cardTitle, onClose }: QrModalProps) {
  const {
    data: blobUrl,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["qr", cardId],
    queryFn: () => fetchQrBlobUrl(cardId),
    staleTime: Infinity,
  });

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>QR Code</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">{cardTitle}</p>
        <div className="qr-modal-body">
          {isLoading && <p className="dash-loading">Summoning QR code…</p>}
          {isError && (
            <p className="alert-error">Failed to load QR code. Try again.</p>
          )}
          {blobUrl && (
            <img
              className="qr-image"
              src={blobUrl}
              alt={`QR code for ${cardTitle}`}
            />
          )}
        </div>
        {blobUrl && (
          <div className="qr-modal-footer">
            <a
              className="btn-primary"
              href={blobUrl}
              download={`${cardTitle.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
            >
              ⬇ Download PNG
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProofModalProps {
  cardId: string;
  cardTitle: string;
  onClose: () => void;
}

function getDownloadFileName(cardTitle: string, suffix: string) {
  return `${cardTitle.replace(/\s+/g, "-").toLowerCase()}-${suffix}.png`;
}

function ProofModal({ cardId, cardTitle, onClose }: ProofModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const {
    data: proofBlob,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["card-proof", cardId],
    queryFn: () => renderCardProof(cardId),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!proofBlob) {
      setBlobUrl(null);
      return;
    }

    const nextBlobUrl = URL.createObjectURL(proofBlob);
    setBlobUrl(nextBlobUrl);

    return () => {
      URL.revokeObjectURL(nextBlobUrl);
    };
  }, [proofBlob]);

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div
        className="qr-modal proof-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-modal-header">
          <h3>Digital Proof</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">{cardTitle}</p>
        <div className="qr-modal-body">
          {isLoading && <p className="dash-loading">Rendering proof…</p>}
          {isError && (
            <p className="alert-error">
              Failed to render the digital proof. Try again.
            </p>
          )}
          {blobUrl && (
            <img
              className="qr-image proof-preview"
              src={blobUrl}
              alt={`Digital proof for ${cardTitle}`}
            />
          )}
        </div>
        {blobUrl && (
          <div className="qr-modal-footer">
            <a
              className="btn-primary"
              href={blobUrl}
              download={getDownloadFileName(cardTitle, "proof")}
            >
              ⬇ Download Proof
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Coming Soon</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">Upgrade Card</p>
        <div className="qr-modal-body">
          <p>
            This feature is coming soon! We're working on making it even easier
            to upgrade your cards to Premium.
          </p>
        </div>
        <div className="qr-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [qrCard, setQrCard] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [proofCard, setProofCard] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const {
    data: cards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["cards"],
    queryFn: getCards,
  });
  const [cardSearch, setCardSearch] = useState("");

  const premiumCount =
    cards?.filter((c) => isPremium(c.premium_expires_at)).length ?? 0;
  const draftCount = (cards?.length ?? 0) - premiumCount;
  const filteredCards =
    cards?.filter((card) =>
      card.data.title.toLowerCase().includes(cardSearch.trim().toLowerCase()),
    ) ?? [];

  return (
    <div className="page-stack">
      {qrCard && (
        <QrModal
          cardId={qrCard.id}
          cardTitle={qrCard.title}
          onClose={() => setQrCard(null)}
        />
      )}
      {proofCard && (
        <ProofModal
          cardId={proofCard.id}
          cardTitle={proofCard.title}
          onClose={() => setProofCard(null)}
        />
      )}
      {showPlanModal && <PlanModal onClose={() => setShowPlanModal(false)} />}
      {showUpgradeModal && (
        <ComingSoonModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {/* ── Hero Banner ── */}
      <section className="content-hero">
        <div>
          {/* <p className="dash-kicker">⚔ Let the Adventure Begin!</p> */}
          <h1>Let the Adventure Begin</h1>
          <p className="content-hero-copy">
            Your profiles are ready to be unleashed. Forge new cards, track
            orders, and level up your legendary presence.
          </p>
        </div>
        <Link className="btn-primary btn-lg" to="/app/cards/new">
          ✦ Create New Card
        </Link>
      </section>

      {/* ── Dashboard Body ── */}
      <div className="dash-body">
        {/* ── Main Column ── */}
        <div className="dash-main">
          {/* Plan summary band */}
          <div className="dash-plan-band">
            <div className="dash-plan-stats">
              <div className="dash-plan-stat">
                <span className="dash-plan-stat-value">{draftCount}</span>
                <span className="dash-plan-stat-label">Draft</span>
              </div>
              <div className="dash-plan-divider" />
              <div className="dash-plan-stat">
                <span className="dash-plan-stat-value dash-plan-stat-value--gold">
                  {premiumCount}
                </span>
                <span className="dash-plan-stat-label">✦ Premium</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowPlanModal(true)}
            >
              Compare plans
            </button>
          </div>

          {/* My Cards */}
          <section className="dash-panel">
            <div className="dash-panel-header">
              <div className="dash-panel-heading-block">
                <h2 className="dash-panel-title">My Cards</h2>
                <span className="meta-pill">
                  {filteredCards.length} shown / {cards?.length ?? 0} total
                </span>
              </div>
              <label className="dash-search-field" aria-label="Search cards">
                <span className="dash-search-icon">⌕</span>
                <input
                  type="search"
                  value={cardSearch}
                  onChange={(event) => setCardSearch(event.target.value)}
                  placeholder="Search by title"
                />
              </label>
            </div>

            {isLoading && <p className="dash-loading">Summoning your cards…</p>}
            {isError && (
              <p className="alert-error">
                The scroll is damaged. Failed to load cards.
              </p>
            )}

            {!isLoading && !isError && (cards?.length ?? 0) === 0 && (
              <div className="dash-empty">
                <p className="dash-empty-icon">🃏</p>
                <h3>Your deck is empty</h3>
                <p>
                  Your legend hasn't been written yet. Create your first card to
                  begin your adventure.
                </p>
                <Link
                  className="btn-primary dash-empty-cta"
                  to="/app/cards/new"
                >
                  Forge Your First Card
                </Link>
              </div>
            )}

            {!isLoading && !isError && (cards?.length ?? 0) > 0 && (
              <div className="dash-cards-grid">
                {filteredCards.map((card, i) => {
                  const cardBorderTint =
                    CARD_TINT_BORDERS[i % CARD_TINT_BORDERS.length];

                  return (
                    <article key={card.id} className="dash-card-item">
                      <div className="dash-card-stack">
                        <Link
                          className="dash-card-link"
                          to={`/app/cards/${card.id}`}
                        >
                          <div
                            className="dash-card-stage"
                            style={{
                              backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.82)), ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]}`,
                            }}
                          >
                            <div className="dash-card-face">
                              {card.last_render ? (
                                <img
                                  className="dash-card-render"
                                  src={card.last_render}
                                  alt={card.data.title}
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = "none";
                                    const sibling =
                                      target.nextElementSibling as HTMLElement | null;
                                    if (sibling) sibling.style.display = "flex";
                                  }}
                                />
                              ) : null}
                              <span
                                className="dash-card-initial"
                                style={
                                  card.last_render
                                    ? { display: "none" }
                                    : undefined
                                }
                              >
                                {card.data.title?.[0]?.toUpperCase() ?? "?"}
                              </span>
                              {isPremium(card.premium_expires_at) ? (
                                <span className="card-tier-badge card-tier-badge--premium">
                                  ✦ Premium
                                </span>
                              ) : (
                                <span className="card-tier-badge card-tier-badge--draft">
                                  Draft
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                        <div
                          className={`dash-card-actions${isPremium(card.premium_expires_at) ? " dash-card-actions--premium" : " dash-card-actions--draft"}`}
                          style={{ borderColor: cardBorderTint }}
                        >
                          {!isPremium(card.premium_expires_at) && (
                            <button
                              type="button"
                              className="dash-action-btn dash-action-btn--upgrade"
                              onClick={() => setShowUpgradeModal(true)}
                            >
                              ✦ Upgrade
                            </button>
                          )}
                          <button
                            type="button"
                            className="dash-action-btn dash-action-btn--order"
                          >
                            📦 Order
                          </button>
                          <button
                            type="button"
                            className="dash-action-btn dash-action-btn--proof"
                            onClick={() =>
                              setProofCard({
                                id: card.id,
                                title: card.data.title,
                              })
                            }
                          >
                            ⬇ Proof
                          </button>
                          <button
                            type="button"
                            className="dash-action-btn dash-action-btn--qr"
                            onClick={() =>
                              setQrCard({ id: card.id, title: card.data.title })
                            }
                          >
                            ◉ QR
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!isLoading &&
              !isError &&
              (cards?.length ?? 0) > 0 &&
              filteredCards.length === 0 && (
                <div className="dash-empty dash-empty--search">
                  <p className="dash-empty-icon">🔎</p>
                  <h3>No matching cards</h3>
                  <p>Try a different title or clear the search field.</p>
                </div>
              )}
          </section>
        </div>

        {/* ── Sidebar ── */}
        <aside className="dash-sidebar">
          <div className="dash-panel">
            <h3 className="dash-panel-title">Quick Actions</h3>
            <nav className="dash-quick-list">
              <Link className="dash-quick-item" to="/app/cards/new">
                <div className="dash-quick-icon">✦</div>
                <div>
                  <span className="dash-quick-label">Create New Card</span>
                  <span className="dash-quick-sub">Start your next legend</span>
                </div>
              </Link>
              <a className="dash-quick-item" href="#">
                <div className="dash-quick-icon">📦</div>
                <div>
                  <span className="dash-quick-label">Order Cards</span>
                  <span className="dash-quick-sub">
                    Turn your legend into reality
                  </span>
                </div>
              </a>
              <a className="dash-quick-item" href="#">
                <div className="dash-quick-icon">⚙</div>
                <div>
                  <span className="dash-quick-label">Manage Subscription</span>
                  <span className="dash-quick-sub">Upgrade your quest</span>
                </div>
              </a>
              <a className="dash-quick-item dash-quick-item--locked" href="#">
                <div className="dash-quick-icon">🔗</div>
                <div>
                  <span className="dash-quick-label">View Link Hub</span>
                  <span className="dash-quick-sub dash-quick-sub--pro">
                    ✦ Pro feature
                  </span>
                </div>
              </a>
            </nav>
          </div>

          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">Orders</h3>
              <span className="meta-pill">0 active</span>
            </div>
            <div className="dash-orders-empty">
              <div className="dash-orders-empty-icon">📜</div>
              <p>No active orders.</p>
              <p>
                When you order physical cards, your quests will appear here
                along with tracking and delivery updates.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
