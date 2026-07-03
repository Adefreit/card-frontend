import { Link } from "react-router-dom";
import type { AdminUserCardRecord } from "../../api";
import { useAdminUserDetailContext } from "./AdminUserDetailContext";
import { formatDate } from "./helpers";

type AdminUserCardsTabProps = {
  cards: AdminUserCardRecord[];
};

export default function AdminUserCardsTab({ cards }: AdminUserCardsTabProps) {
  const {
    loadedCardPreviews,
    cardConfirmAction,
    isArtifactPending,
    isCardActionPending,
    onHoverCardPreview,
    onDownloadArtifact,
    onRequestCardAction,
    onClearCardAction,
    onConfirmCardAction,
  } = useAdminUserDetailContext();

  if (cards.length === 0) {
    return <p className="dash-loading">No cards found for this user.</p>;
  }

  const actionLabel =
    cardConfirmAction?.action === "mint"
      ? "Mint"
      : cardConfirmAction?.action === "unmint"
        ? "Unmint"
        : "Repair";

  return (
    <div className="admin-table-wrap admin-tab-panel">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Card</th>
            <th>Status</th>
            <th>Created</th>
            <th>Download</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const minted = Boolean(card.minted);
            const previewSrc = card.last_render ?? card.last_proof ?? null;

            return (
              <tr key={card.id} className="admin-card-row">
                <td
                  className="admin-card-row__title-cell admin-card-row__preview-parent"
                  onMouseEnter={() => onHoverCardPreview(card.id)}
                >
                  <strong>{card.data?.title ?? "Untitled"}</strong>
                  <br />
                  <small>
                    <Link to={`/cardviewer/${card.id}`}>{card.id}</Link>
                  </small>
                  {previewSrc && loadedCardPreviews.has(card.id) ? (
                    <div className="admin-card-row__preview-tooltip">
                      <img
                        src={previewSrc}
                        alt={card.data?.title ?? "Card preview"}
                      />
                    </div>
                  ) : null}
                </td>
                <td>
                  <span
                    className={`admin-stage-badge admin-stage-badge--${
                      minted ? "delivered" : "pending"
                    }`}
                  >
                    {minted ? "Minted" : "Draft"}
                  </span>
                </td>
                <td>{formatDate(card.create_time)}</td>
                <td>
                  <div className="admin-icon-buttons">
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() =>
                        onRequestCardAction({
                          cardId: card.id,
                          action: "repair",
                        })
                      }
                      disabled={isCardActionPending}
                      title="Repair card"
                      aria-label="Repair card"
                    >
                      🔧
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => onDownloadArtifact(card.id, "preview")}
                      disabled={isArtifactPending}
                      title="Download preview"
                    >
                      👁️
                    </button>
                    {minted ? (
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => onDownloadArtifact(card.id, "proof")}
                        disabled={isArtifactPending}
                        title="Download proof"
                      >
                        📄
                      </button>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="admin-icon-buttons">
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() =>
                        onRequestCardAction({
                          cardId: card.id,
                          action: minted ? "unmint" : "mint",
                        })
                      }
                      disabled={isCardActionPending}
                    >
                      {minted ? "Unmint" : "Mint"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {cardConfirmAction ? (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal--small">
            <div className="admin-modal-header">
              <h3>Confirm {actionLabel}</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={onClearCardAction}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              {cardConfirmAction.action === "mint" ? (
                <p>
                  Minting this card will regenerate the proof artifact and mark
                  the card as minted. This is a permanent state change.
                </p>
              ) : cardConfirmAction.action === "repair" ? (
                <p>
                  Repairing this card will call the repair endpoint and attempt
                  to rebuild card artifacts for the current card state.
                </p>
              ) : (
                <p>
                  Unminting this card will remove the minted state, delete
                  stored artifacts, and regenerate a fresh unminted preview.
                  This action cannot be easily reversed.
                </p>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClearCardAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  cardConfirmAction.action === "mint"
                    ? "btn-primary"
                    : cardConfirmAction.action === "unmint"
                      ? "btn-danger"
                      : "btn-secondary"
                }
                onClick={onConfirmCardAction}
                disabled={isCardActionPending}
              >
                {isCardActionPending
                  ? "Processing..."
                  : `Confirm ${actionLabel}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
