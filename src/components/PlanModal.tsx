import {
  type StripePriceSummary,
  type SubscriptionTypePricing,
} from "../features/transactions/api";
import PlanComparisonTable from "./PlanComparisonTable";

export default function PlanModal({
  onClose,
  plans,
  selectedPlanId,
  onSelectPlan,
  selectedInterval,
  onSelectInterval,
  onStartSubscription,
  onResumeSubscription,
  isCancellationScheduled,
  isResumePending,
  isStartPending,
  isSubscribed,
  mintPrice,
}: {
  onClose: () => void;
  plans: SubscriptionTypePricing[];
  selectedPlanId: string;
  onSelectPlan: (id: string) => void;
  selectedInterval: "month" | "year";
  onSelectInterval: (interval: "month" | "year") => void;
  onStartSubscription: () => void;
  onResumeSubscription: () => void;
  isCancellationScheduled: boolean;
  isResumePending: boolean;
  isStartPending: boolean;
  isSubscribed: boolean;
  mintPrice?: StripePriceSummary | null;
}) {
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Free vs. Founder Subscription</h3>
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
          Pick a model that fits your journey today.
        </p>
        {isCancellationScheduled ? (
          <p className="alert-success" style={{ margin: "8px 22px 0" }}>
            Cancellation is scheduled. Resume to keep your current subscription
            active and avoid duplicate billing.
          </p>
        ) : null}
        <PlanComparisonTable
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={onSelectPlan}
          selectedInterval={selectedInterval}
          onSelectInterval={onSelectInterval}
          onStartSubscription={onStartSubscription}
          isStartPending={isStartPending}
          isSubscribed={isSubscribed}
          mintPrice={mintPrice}
        />
        <div className="qr-modal-footer">
          {isCancellationScheduled ? (
            <button
              type="button"
              className="btn-primary"
              onClick={onResumeSubscription}
              disabled={isResumePending}
            >
              {isResumePending ? "Resuming..." : "Resume Subscription"}
            </button>
          ) : null}
          {!selectedPlan ? (
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              No subscription plans are currently available.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
