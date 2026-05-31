import type { UseMutationResult } from "@tanstack/react-query";
import type { AdminOrderFulfillmentNote } from "../../api";

interface FulfillmentNoteEditorProps {
  draftText: string;
  onDraftChange: (text: string) => void;
  addNoteMutation: UseMutationResult<
    AdminOrderFulfillmentNote,
    Error,
    string,
    unknown
  >;
  isOrderLoaded: boolean;
}

export function FulfillmentNoteEditor({
  draftText,
  onDraftChange,
  addNoteMutation,
  isOrderLoaded,
}: FulfillmentNoteEditorProps) {
  return (
    <div className="admin-order-note-editor">
      <label>
        <span>Add fulfillment note</span>
        <textarea
          value={draftText}
          onChange={(event) => onDraftChange(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Add a note without changing status"
        />
      </label>
      <button
        type="button"
        className="btn-secondary"
        disabled={
          addNoteMutation.isPending ||
          draftText.trim().length === 0 ||
          !isOrderLoaded
        }
        onClick={() => addNoteMutation.mutate(draftText.trim())}
      >
        {addNoteMutation.isPending ? "Saving..." : "Add Note"}
      </button>
    </div>
  );
}
