import { useState } from "react";
import type { AdminFulfillmentStage } from "../api";

function humanizeText(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────
// METADATA FIELD REGISTRY
// Each entry defines a known metadata key with an optional label and whether
// it is required for a given stage (controlled via STAGE_CONFIG below).
// Add new keys here to make them available in the dropdown.
// ─────────────────────────────────────────────────────────────────────────────
const KNOWN_META_FIELDS: { key: string; label: string }[] = [
  { key: "print_order_id", label: "Print Order ID" },
  { key: "shipping_vendor", label: "Shipping Vendor" },
  { key: "tracking_number", label: "Tracking Number" },
  { key: "hold_reason", label: "Hold Reason" },
  { key: "cancel_reason", label: "Cancel Reason" },
  { key: "notes", label: "Notes" },
];

// ─────────────────────────────────────────────────────────────────────────────
// STAGE CONFIG
// defaultNote     — pre-filled note text
// requiredMetaKeys — keys that MUST have a value; shown first and marked *
// optionalMetaKeys — keys pre-added but not required
// noteRequired    — if true, note field must be non-empty
// hint            — description shown under the modal title
// ─────────────────────────────────────────────────────────────────────────────
interface StageConfig {
  defaultNote: string;
  requiredMetaKeys: string[];
  optionalMetaKeys: string[];
  noteRequired: boolean;
  hint: string;
}

const STAGE_CONFIG: Partial<Record<AdminFulfillmentStage, StageConfig>> = {
  preparing: {
    defaultNote: "Order is being prepared for shipment.",
    requiredMetaKeys: ["print_order_id"],
    optionalMetaKeys: [],
    noteRequired: false,
    hint: "A print order ID is required before moving to preparing.",
  },
  complete: {
    defaultNote: "Order has shipped to the customer.",
    requiredMetaKeys: ["shipping_vendor", "tracking_number"],
    optionalMetaKeys: [],
    noteRequired: false,
    hint: "Shipping vendor and tracking number are required.",
  },
  on_hold: {
    defaultNote: "",
    requiredMetaKeys: [],
    optionalMetaKeys: ["hold_reason"],
    noteRequired: true,
    hint: "A note explaining why the order is on hold is required.",
  },
  cancelled: {
    defaultNote: "",
    requiredMetaKeys: [],
    optionalMetaKeys: ["cancel_reason"],
    noteRequired: true,
    hint: "A note explaining the cancellation reason is required.",
  },
};

type MetadataRow = { key: string; value: string; required: boolean };

function buildInitialRows(config: StageConfig | undefined): MetadataRow[] {
  const required = (config?.requiredMetaKeys ?? []).map((key) => ({
    key,
    value: "",
    required: true,
  }));
  const optional = (config?.optionalMetaKeys ?? []).map((key) => ({
    key,
    value: "",
    required: false,
  }));
  return [...required, ...optional];
}

interface StageAdvanceModalProps {
  targetStage: AdminFulfillmentStage;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (note: string, metadata: Record<string, unknown>) => void;
}

export default function StageAdvanceModal({
  targetStage,
  isPending,
  onClose,
  onConfirm,
}: StageAdvanceModalProps) {
  const config = STAGE_CONFIG[targetStage];
  const requiredMetaKeys = config?.requiredMetaKeys ?? [];
  const noteRequired = config?.noteRequired ?? false;

  const [note, setNote] = useState(config?.defaultNote ?? "");
  const [metadataRows, setMetadataRows] = useState<MetadataRow[]>(() =>
    buildInitialRows(config),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const usedKeys = new Set(metadataRows.map((r) => r.key));
  const availableFields = KNOWN_META_FIELDS.filter((f) => !usedKeys.has(f.key));

  function addRow(key: string) {
    if (!key) return;
    setMetadataRows((prev) => [...prev, { key, value: "", required: false }]);
  }

  function removeRow(index: number) {
    setMetadataRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateValue(index: number, value: string) {
    setMetadataRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, value } : row)),
    );
    if (validationError) setValidationError(null);
  }

  function handleConfirm() {
    if (noteRequired && !note.trim()) {
      setValidationError("A note is required for this stage transition.");
      return;
    }
    for (const requiredKey of requiredMetaKeys) {
      const row = metadataRows.find((r) => r.key === requiredKey);
      if (!row || !row.value.trim()) {
        setValidationError(`"${requiredKey}" is required and cannot be empty.`);
        return;
      }
    }
    setValidationError(null);
    const metadata: Record<string, unknown> = {};
    for (const row of metadataRows) {
      const v = row.value.trim();
      if (v) metadata[row.key] = v;
    }
    onConfirm(note.trim(), metadata);
  }

  return (
    <div
      className="admin-modal-overlay"
      onClick={isPending ? undefined : onClose}
    >
      <div
        className="admin-modal admin-stage-advance-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          Move to{" "}
          <span
            className={`admin-stage-badge admin-stage-badge--${targetStage}`}
          >
            {humanizeText(targetStage)}
          </span>
        </h3>

        {config?.hint ? (
          <p className="admin-modal-hint">{config.hint}</p>
        ) : (
          <p className="admin-modal-hint">
            Optionally attach a note and metadata to this stage transition.
          </p>
        )}

        <div className="admin-modal-section">
          <label>
            <span className="admin-section-label">
              Note
              {noteRequired ? (
                <span className="admin-required-star"> *</span>
              ) : (
                " (optional)"
              )}
            </span>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (validationError) setValidationError(null);
              }}
              maxLength={2000}
              rows={3}
              placeholder={
                noteRequired
                  ? "Required — explain this transition..."
                  : "Context for this status change..."
              }
              style={{ width: "100%", boxSizing: "border-box" }}
              disabled={isPending}
            />
          </label>
        </div>

        <div className="admin-modal-section">
          <div className="admin-modal-section-header">
            <span className="admin-section-label">Metadata</span>
            {availableFields.length > 0 ? (
              <select
                className="admin-meta-add-select"
                value=""
                onChange={(e) => addRow(e.target.value)}
                disabled={isPending}
              >
                <option value="">+ Add field</option>
                {availableFields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {metadataRows.length > 0 ? (
            <div className="admin-meta-kv-list">
              {metadataRows.map((row, index) => {
                const fieldDef = KNOWN_META_FIELDS.find(
                  (f) => f.key === row.key,
                );
                return (
                  <div key={row.key} className="admin-meta-kv-row">
                    <span className="admin-meta-kv-label">
                      {fieldDef?.label ?? row.key}
                      {row.required ? (
                        <span className="admin-required-star"> *</span>
                      ) : null}
                    </span>
                    <input
                      placeholder={row.required ? "required" : "value"}
                      value={row.value}
                      onChange={(e) => updateValue(index, e.target.value)}
                      disabled={isPending}
                    />
                    {row.required ? null : (
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => removeRow(index)}
                        disabled={isPending}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="admin-order-empty">No metadata fields.</p>
          )}
        </div>

        {validationError ? (
          <p className="admin-modal-error">{validationError}</p>
        ) : null}

        <div className="admin-refund-modal-footer" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Updating..." : `Move to ${humanizeText(targetStage)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
