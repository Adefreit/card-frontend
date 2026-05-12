import type { UseMutationResult } from "@tanstack/react-query";
import { formatCents } from "../../utils";

interface RefundModalProps {
  isOpen: boolean;
  refundCents: number;
  refundReason: string;
  remainingRefundable: number;
  refundMutation: UseMutationResult<any, any, any, any>;
  onClose: () => void;
  onRefundCentsChange: (cents: number) => void;
  onRefundReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

export function RefundModal({
  isOpen,
  refundCents,
  refundReason,
  remainingRefundable,
  refundMutation,
  onClose,
  onRefundCentsChange,
  onRefundReasonChange,
  onConfirm,
}: RefundModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="admin-refund-modal-overlay" onClick={onClose}>
      <div
        className="admin-refund-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Issue Refund</h3>

        <div className="admin-refund-warning">
          This action is permanent and cannot be undone.
        </div>

        <label htmlFor="refund-cents">Refund amount (cents)</label>
        <input
          id="refund-cents"
          type="number"
          min={1}
          max={remainingRefundable || undefined}
          value={refundCents}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (Number.isNaN(nextValue)) {
              onRefundCentsChange(0);
              return;
            }
            onRefundCentsChange(Math.max(0, Math.floor(nextValue)));
          }}
        />

        <label htmlFor="refund-reason">Reason</label>
        <textarea
          id="refund-reason"
          placeholder="Describe the reason for this refund..."
          value={refundReason}
          onChange={(event) => onRefundReasonChange(event.target.value)}
          maxLength={2000}
        />

        {refundMutation.isError ? (
          <p className="admin-refund-warning" style={{ marginBottom: 14 }}>
            Refund failed. Please check the amount and try again.
          </p>
        ) : null}

        <div className="admin-refund-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={refundMutation.isPending}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-danger"
            disabled={
              refundMutation.isPending ||
              refundCents <= 0 ||
              refundCents > remainingRefundable ||
              refundReason.trim().length === 0
            }
            onClick={onConfirm}
          >
            {refundMutation.isPending
              ? "Processing..."
              : `Refund ${formatCents(refundCents)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
