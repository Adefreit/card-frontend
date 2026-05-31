import type { UseMutationResult } from "@tanstack/react-query";

interface CardsAndProofsSectionProps {
  groupedCards: Array<[string, number]>;
  downloadProofMutation: UseMutationResult<
    string | null,
    Error,
    { cardId: string },
    unknown
  >;
  fetchedCardId: string | null;
  fetchedProofUrl: string | null;
}

export function CardsAndProofsSection({
  groupedCards,
  downloadProofMutation,
  fetchedCardId,
  fetchedProofUrl,
}: CardsAndProofsSectionProps) {
  return (
    <div style={{ marginTop: 16 }}>
      <p className="admin-order-subsection-title">Cards &amp; Proofs</p>
      <div className="admin-table-wrap">
        <table className="admin-table admin-order-items-grid-table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Qty</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {groupedCards.map(([label, quantity]) => {
              const cardId = label;
              return (
                <tr key={label}>
                  <td>
                    <span className="admin-card-preview-wrap">{label}</span>
                  </td>
                  <td>{quantity}</td>
                  <td>
                    {cardId ? (
                      fetchedCardId === cardId && fetchedProofUrl ? (
                        <a
                          className="btn-secondary btn-xs"
                          href={fetchedProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Save as...
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() =>
                            downloadProofMutation.mutate({
                              cardId,
                            })
                          }
                          disabled={downloadProofMutation.isPending}
                        >
                          {downloadProofMutation.isPending
                            ? "Loading..."
                            : "Get Link"}
                        </button>
                      )
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
