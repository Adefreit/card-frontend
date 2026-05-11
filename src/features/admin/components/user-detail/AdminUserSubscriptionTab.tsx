import type { AdminUserRecord } from "../../api";
import { useAdminUserDetailContext } from "./AdminUserDetailContext";
import { formatDate, isSubscriptionActive } from "./helpers";

type AdminUserSubscriptionTabProps = {
  user: AdminUserRecord;
};

export default function AdminUserSubscriptionTab({
  user,
}: AdminUserSubscriptionTabProps) {
  const {
    subscriptionModal,
    subscriptionDays,
    subscriptionCustomDate,
    subscriptionUseCustom,
    subscriptionConfirm,
    isExtendPending,
    onOpenSubscriptionModal,
    onCloseSubscriptionModal,
    onSetSubscriptionDays,
    onSetSubscriptionCustomDate,
    onSetSubscriptionUseCustom,
    onSetSubscriptionConfirm,
    onExtendSubscription,
  } = useAdminUserDetailContext();

  return (
    <div className="admin-stack admin-tab-panel">
      <div className="detail-meta-grid">
        <div className="detail-meta-item">
          <span>Current Plan</span>
          <strong>
            {isSubscriptionActive(user.account_subscription_until)
              ? "Active subscription"
              : "Free plan"}
          </strong>
        </div>
        <div className="detail-meta-item">
          <span>Subscription Until</span>
          <strong>{formatDate(user.account_subscription_until)}</strong>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={onOpenSubscriptionModal}
        style={{ marginTop: 16 }}
      >
        Extend Subscription
      </button>

      {subscriptionModal ? (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Extend Subscription</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={onCloseSubscriptionModal}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              {!subscriptionConfirm ? (
                <>
                  <p style={{ marginBottom: 16, color: "var(--ui-muted)" }}>
                    Choose how to extend this user's subscription:
                  </p>

                  <div className="admin-modal-section">
                    <span
                      className="admin-section-label"
                      style={{ marginBottom: 10 }}
                    >
                      Quick Options
                    </span>
                    <div className="admin-inline-form">
                      {[30, 90, 180, 365].map((days) => (
                        <button
                          key={days}
                          type="button"
                          className={`btn-secondary${
                            !subscriptionUseCustom && subscriptionDays === days
                              ? " is-selected"
                              : ""
                          }`}
                          onClick={() => {
                            onSetSubscriptionDays(days);
                            onSetSubscriptionUseCustom(false);
                          }}
                          style={{
                            background:
                              !subscriptionUseCustom &&
                              subscriptionDays === days
                                ? "rgba(91, 99, 255, 0.18)"
                                : undefined,
                          }}
                        >
                          +{days} Days
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className="admin-modal-section"
                    style={{ marginTop: 14 }}
                  >
                    <span
                      className="admin-section-label"
                      style={{ marginBottom: 10 }}
                    >
                      Or Set Custom Date
                    </span>
                    <div className="admin-inline-form">
                      <input
                        type="date"
                        value={subscriptionCustomDate}
                        onChange={(event) => {
                          onSetSubscriptionCustomDate(event.target.value);
                          if (event.target.value) {
                            onSetSubscriptionUseCustom(true);
                          }
                        }}
                      />
                      {subscriptionCustomDate && (
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--ui-muted)",
                          }}
                        >
                          {new Date(
                            subscriptionCustomDate,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <p style={{ marginBottom: 16 }}>
                    <strong>Confirm Subscription Extension</strong>
                  </p>
                  <p style={{ color: "var(--ui-muted)", marginBottom: 12 }}>
                    {subscriptionUseCustom && subscriptionCustomDate
                      ? `Extend subscription until: ${new Date(
                          subscriptionCustomDate,
                        ).toLocaleDateString()}`
                      : `Add ${subscriptionDays} days to the subscription`}
                  </p>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--ui-muted)",
                      marginBottom: 16,
                    }}
                  >
                    This action cannot be undone. The user's subscription will
                    be extended.
                  </p>
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (subscriptionConfirm) {
                    onSetSubscriptionConfirm(false);
                  } else {
                    onCloseSubscriptionModal();
                  }
                }}
              >
                {subscriptionConfirm ? "Back" : "Cancel"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!subscriptionConfirm) {
                    onSetSubscriptionConfirm(true);
                  } else {
                    onExtendSubscription();
                  }
                }}
                disabled={
                  (subscriptionUseCustom && !subscriptionCustomDate) ||
                  isExtendPending
                }
              >
                {subscriptionConfirm
                  ? isExtendPending
                    ? "Extending..."
                    : "Confirm"
                  : "Next"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
