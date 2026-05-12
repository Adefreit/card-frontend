import type { AdminFulfillmentStage } from "../../api";
import type { AdminOrderRecord } from "../../api";
import { formatDate, humanizeText } from "../../utils";

interface FulfillmentStatusPanelProps {
  order: AdminOrderRecord;
  currentStage: AdminFulfillmentStage;
}

export function FulfillmentStatusPanel({
  order,
  currentStage,
}: FulfillmentStatusPanelProps) {
  const railToneClass = `admin-order-rail-status admin-order-rail-status--${currentStage}`;

  return (
    <>
      <p className="admin-order-section-title" style={{ marginBottom: 8 }}>
        Fulfillment Status
      </p>

      <div className={railToneClass}>
        <div className="admin-order-rail-status__label">Current status</div>
        <div className="admin-order-rail-status__value">
          {humanizeText(currentStage)}
        </div>
        <div className="admin-order-rail-status__time">
          Last update{" "}
          {formatDate(order.fulfillment_update_time ?? order.update_time)}
        </div>
      </div>
    </>
  );
}
