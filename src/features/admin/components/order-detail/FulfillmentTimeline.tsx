import type { AdminOrderFulfillmentNote } from "../../api";
import { formatDate, humanizeText } from "../../utils";

interface FulfillmentTimelineProps {
  notes: AdminOrderFulfillmentNote[];
}

export function FulfillmentTimeline({ notes }: FulfillmentTimelineProps) {
  return (
    <div className="admin-order-stage-panel" style={{ marginTop: 12 }}>
      <p className="admin-order-section-title">Timeline</p>
      {notes.length === 0 ? (
        <p className="admin-order-empty">No fulfillment notes recorded yet.</p>
      ) : (
        <div className="admin-order-timeline">
          {notes.slice(0, 8).map((note: AdminOrderFulfillmentNote) => {
            const metaEntries = Object.entries(note.metadata ?? {}).filter(
              ([k]) => k !== "source",
            );
            const sourceValue = (note.metadata as Record<string, unknown>)
              ?.source;

            return (
              <div key={note.id} className="admin-timeline-entry">
                <span className="admin-timeline-entry__date">
                  {formatDate(note.create_time)}
                  {sourceValue ? (
                    <span className="admin-timeline-entry__source">
                      {" "}
                      via {String(sourceValue)}
                    </span>
                  ) : null}
                </span>
                {note.from_stage !== note.to_stage ? (
                  <p className="admin-timeline-entry__stage">
                    <span
                      className={`admin-stage-badge admin-stage-badge--${
                        note.from_stage ?? "pending"
                      }`}
                    >
                      {humanizeText(note.from_stage ?? "pending")}
                    </span>
                    {" → "}
                    <span
                      className={`admin-stage-badge admin-stage-badge--${note.to_stage}`}
                    >
                      {humanizeText(note.to_stage)}
                    </span>
                  </p>
                ) : null}
                {note.note ? (
                  <p className="admin-timeline-entry__note">{note.note}</p>
                ) : null}
                {metaEntries.length > 0 ? (
                  <details className="admin-timeline-meta-details">
                    <summary className="admin-timeline-meta-summary">
                      {metaEntries.length}{" "}
                      {metaEntries.length === 1
                        ? "metadata key"
                        : "metadata keys"}
                    </summary>
                    <table className="admin-timeline-meta-table">
                      <tbody>
                        {metaEntries.map(([k, v]) => (
                          <tr key={k}>
                            <td className="admin-timeline-meta-table__key">
                              {k}
                            </td>
                            <td>{String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
