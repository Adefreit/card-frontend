interface RawDataSectionProps {
  rawPayloadText: string;
  onCopyClick: () => void;
  onDownloadClick: () => void;
}

export function RawDataSection({
  rawPayloadText,
  onCopyClick,
  onDownloadClick,
}: RawDataSectionProps) {
  return (
    <div className="admin-order-section">
      <div className="admin-order-section-header">
        <p className="admin-order-section-title" style={{ margin: 0 }}>
          Raw Data
        </p>
        <div className="admin-order-section-actions">
          <button type="button" className="btn-secondary" onClick={onCopyClick}>
            Copy Raw JSON
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onDownloadClick}
          >
            Download Raw JSON
          </button>
        </div>
      </div>
      <details>
        <summary className="admin-order-expand-summary">
          Show raw payload
        </summary>
        <textarea
          readOnly
          value={rawPayloadText}
          style={{
            width: "100%",
            marginTop: 10,
            minHeight: 220,
            maxHeight: 420,
            resize: "vertical",
            fontFamily: "monospace",
            fontSize: "0.78rem",
            lineHeight: 1.45,
          }}
        />
      </details>
    </div>
  );
}
