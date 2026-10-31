import { useRef, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

type LinkField = "name" | "url";

interface NamedLinkListEditorProps {
  fields: { id: string }[];
  registerField: (index: number, field: LinkField) => UseFormRegisterReturn;
  getError: (index: number, field: LinkField) => string | undefined;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  nameHeading: string;
  urlHeading: string;
  namePlaceholder: string;
  urlPlaceholder: string;
  emptyMessage: string;
  nested?: boolean;
}

export default function NamedLinkListEditor({
  fields,
  registerField,
  getError,
  onMove,
  onRemove,
  nameHeading,
  urlHeading,
  namePlaceholder,
  urlPlaceholder,
  emptyMessage,
  nested = false,
}: NamedLinkListEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (fields.length === 0) {
    return <div className="detail-config-empty-state">{emptyMessage}</div>;
  }

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div
      className={`link-editor${nested ? " link-editor--nested" : ""}`}
      role="list"
    >
      <div className="link-editor__head" aria-hidden="true">
        <span />
        <span>{nameHeading}</span>
        <span>{urlHeading}</span>
        <span />
      </div>

      {fields.map((field, index) => {
        const nameError = getError(index, "name");
        const urlError = getError(index, "url");
        const classNames = ["link-editor__row"];
        if (dragIndex === index) classNames.push("is-dragging");
        if (overIndex === index && dragIndex !== null && dragIndex !== index) {
          classNames.push("is-drop-target");
        }

        return (
          <div
            key={field.id}
            role="listitem"
            ref={(node) => {
              rowRefs.current[index] = node;
            }}
            className={classNames.join(" ")}
            onDragOver={(event) => {
              if (dragIndex === null) return;
              event.preventDefault();
              setOverIndex(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                onMove(dragIndex, index);
              }
              endDrag();
            }}
          >
            <span
              className="link-editor__handle"
              draggable
              title="Drag to reorder"
              aria-hidden="true"
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = "move";
                const row = rowRefs.current[index];
                if (row) event.dataTransfer.setDragImage(row, 16, 16);
              }}
              onDragEnd={endDrag}
            >
              ⋮⋮
            </span>

            <div className="link-editor__field">
              <input
                aria-label={`${nameHeading} ${index + 1}`}
                placeholder={namePlaceholder}
                {...registerField(index, "name")}
              />
              {nameError ? (
                <small className="field-error">{nameError}</small>
              ) : null}
            </div>

            <div className="link-editor__field">
              <input
                aria-label={`${urlHeading} ${index + 1}`}
                placeholder={urlPlaceholder}
                {...registerField(index, "url")}
              />
              {urlError ? (
                <small className="field-error">{urlError}</small>
              ) : null}
            </div>

            <div className="link-editor__actions">
              <button
                type="button"
                className="btn-secondary btn-xs"
                aria-label={`Move ${nameHeading.toLowerCase()} ${index + 1} up`}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-secondary btn-xs"
                aria-label={`Move ${nameHeading.toLowerCase()} ${index + 1} down`}
                disabled={index === fields.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-secondary btn-xs"
                aria-label={`Remove ${nameHeading.toLowerCase()} ${index + 1}`}
                title="Remove"
                onClick={() => onRemove(index)}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
