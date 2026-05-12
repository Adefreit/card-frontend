import type { UseMutationResult } from "@tanstack/react-query";
import type { AdminFulfillmentStage } from "../../api";
import { humanizeText } from "../../utils";

interface FulfillmentStageControlsProps {
  allowedTargets: Set<AdminFulfillmentStage>;
  isTerminalStage: boolean;
  stageMutation: UseMutationResult<any, any, any, any>;
  onStageClick: (stage: AdminFulfillmentStage) => void;
}

export function FulfillmentStageControls({
  allowedTargets,
  isTerminalStage,
  stageMutation,
  onStageClick,
}: FulfillmentStageControlsProps) {
  if (isTerminalStage || allowedTargets.size === 0) {
    return null;
  }

  return (
    <div className="admin-order-stage-controls" style={{ marginBottom: 10 }}>
      <div className="admin-stage-btn-row">
        {[...allowedTargets].map((stage) => (
          <button
            key={stage}
            type="button"
            className={`admin-stage-transition-btn${
              stage === "cancelled"
                ? " admin-stage-transition-btn--danger"
                : stage === "complete"
                  ? " admin-stage-transition-btn--success"
                  : ""
            }`}
            onClick={() => onStageClick(stage)}
            disabled={stageMutation.isPending}
          >
            <span className="admin-stage-transition-btn__arrow">→</span>
            {humanizeText(stage)}
          </button>
        ))}
      </div>
    </div>
  );
}
