import {
  type StripePriceSummary,
  type SubscriptionTypePricing,
} from "../../transactions/api";

type BillingInterval = "month" | "year";

type PlanCell = string | { included: boolean; text?: string };

export interface PlanComparisonRow {
  key: string;
  label: string;
  free: PlanCell;
  monthly: PlanCell;
  annual: PlanCell;
}

const CHECK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%2316a34a'/%3E%3Cpath d='M4 8.1 6.4 10.5 12 4.9' stroke='white' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const X_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%23dc2626'/%3E%3Cpath d='M5.1 5.1 10.9 10.9M10.9 5.1 5.1 10.9' stroke='white' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";

function formatStripePrice(price: StripePriceSummary) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.unitAmountCents / 100);
}

function renderCell(cell: PlanCell) {
  if (typeof cell === "string") {
    return cell;
  }

  return (
    <span>
      <img
        src={cell.included ? CHECK_ICON : X_ICON}
        alt={cell.included ? "Included" : "Not included"}
        className="plan-status-icon"
      />
      {cell.text ? ` ${cell.text}` : ""}
    </span>
  );
}

function defaultRows(mintPriceLabel: string): PlanComparisonRow[] {
  return [
    {
      key: "draftCards",
      label: "Draft cards",
      free: "Up to 3",
      monthly: "Up to 10",
      annual: "Up to 10",
    },
    {
      key: "freeMints",
      label: "2 free digital mints / month",
      free: { included: false },
      monthly: { included: true },
      annual: { included: true },
    },
    {
      key: "mintDiscount",
      label: "30% discount on digital mints",
      free: { included: false },
      monthly: { included: true },
      annual: { included: true },
    },
    {
      key: "mintPricing",
      label: "Digital mint pricing",
      free: `${mintPriceLabel} per card`,
      monthly: `${mintPriceLabel} base, then 30% off`,
      annual: `${mintPriceLabel} base, then 30% off`,
    },
    {
      key: "editContact",
      label: "Edit Contact Info",
      free: { included: true },
      monthly: { included: true },
      annual: { included: true },
    },
    {
      key: "editLinks",
      label: "Edit User Hub Links",
      free: { included: true },
      monthly: { included: true },
      annual: { included: true },
    },
    {
      key: "prioritySupport",
      label: "Priority Support",
      free: { included: false },
      monthly: { included: true },
      annual: { included: true },
    },
  ];
}

interface PlanComparisonTableProps {
  plans: SubscriptionTypePricing[];
  selectedPlanId: string;
  onSelectPlan: (id: string) => void;
  selectedInterval: BillingInterval;
  onSelectInterval: (interval: BillingInterval) => void;
  onStartSubscription: () => void;
  isStartPending: boolean;
  isSubscribed: boolean;
  mintPrice?: StripePriceSummary | null;
  rows?: PlanComparisonRow[];
}

export default function PlanComparisonTable({
  plans,
  selectedPlanId,
  selectedInterval,
  onSelectInterval,
  onStartSubscription,
  isStartPending,
  isSubscribed,
  mintPrice,
  rows,
}: PlanComparisonTableProps) {
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;
  const canChooseMonthly = Boolean(selectedPlan?.prices.monthly);
  const canChooseYearly = Boolean(selectedPlan?.prices.yearly);
  const mintPriceLabel = mintPrice ? formatStripePrice(mintPrice) : "$10";
  const comparisonRows = rows ?? defaultRows(mintPriceLabel);

  return (
    <div className="plan-compare">
      <div
        className="plan-table-wrap"
        role="region"
        aria-label="Subscription feature comparison"
      >
        <table className="plan-table">
          <thead>
            <tr>
              <th scope="col" className="plan-feature-col">
                Feature
              </th>
              <th scope="col">
                Free
                <br />
                <span className="plan-price">$0</span>
              </th>
              <th
                scope="col"
                className={
                  selectedInterval === "month"
                    ? "plan-col-is-selected"
                    : undefined
                }
              >
                Founder Monthly
                <br />
                <span className="plan-price">
                  {selectedPlan?.prices.monthly
                    ? `${formatStripePrice(selectedPlan.prices.monthly)} / month`
                    : "Monthly unavailable"}
                </span>
              </th>
              <th
                scope="col"
                className={
                  selectedInterval === "year"
                    ? "plan-col-is-selected"
                    : undefined
                }
              >
                Founder Annual
                <br />
                <span className="plan-price">
                  {selectedPlan?.prices.yearly
                    ? `${formatStripePrice(selectedPlan.prices.yearly)} / year`
                    : "Yearly unavailable"}
                </span>
                <br />
                <span className="plan-limited-offer">
                  Limited-time annual pricing
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{renderCell(row.free)}</td>
                <td>{renderCell(row.monthly)}</td>
                <td>{renderCell(row.annual)}</td>
              </tr>
            ))}
          </tbody>
          {!isSubscribed ? (
            <tfoot>
              <tr>
                <th scope="row">Get started</th>
                <td>
                  <span className="plan-footnote">Current tier</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-primary plan-purchase-btn"
                    disabled={!canChooseMonthly || isStartPending}
                    onClick={() => {
                      onSelectInterval("month");
                      onStartSubscription();
                    }}
                  >
                    {isStartPending && selectedInterval === "month"
                      ? "Redirecting..."
                      : "Purchase Monthly"}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-primary plan-purchase-btn"
                    disabled={!canChooseYearly || isStartPending}
                    onClick={() => {
                      onSelectInterval("year");
                      onStartSubscription();
                    }}
                  >
                    {isStartPending && selectedInterval === "year"
                      ? "Redirecting..."
                      : "Purchase Annual"}
                  </button>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
