import type { AdminUserRecord } from "../../api";
import { useAdminUserDetailContext } from "./AdminUserDetailContext";
import { formatDate, isSubscriptionActive } from "./helpers";

type CardStats = {
  total: number;
  drafted: number;
  minted: number;
};

type AdminUserSummaryTabProps = {
  user: AdminUserRecord;
  cardStats: CardStats;
};

export default function AdminUserSummaryTab({
  user,
  cardStats,
}: AdminUserSummaryTabProps) {
  const {
    emailModal,
    emailSubject,
    emailTitle,
    emailHtmlBody,
    emailConfirmAction,
    emailEditorRef,
    isSendEmailPending,
    isResendActivationPending,
    isResendPasswordResetPending,
    onOpenEmailModal,
    onCloseEmailModal,
    onEmailSubjectChange,
    onEmailTitleChange,
    onSyncEmailHtmlBody,
    onApplyEmailFormat,
    onSendEmail,
    onSetEmailConfirmAction,
    onConfirmEmailAction,
  } = useAdminUserDetailContext();

  return (
    <div className="admin-tab-panel">
      <div className="detail-meta-grid">
        <div className="detail-meta-item">
          <span>User ID</span>
          <strong>{user.id}</strong>
        </div>
        <div className="detail-meta-item">
          <span>Email</span>
          <strong>{user.email ?? "-"}</strong>
        </div>
        <div className="detail-meta-item">
          <span>Activated</span>
          <strong>{user.activated ? "Yes" : "No"}</strong>
        </div>
        <div className="detail-meta-item">
          <span>Subscription Status</span>
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
        <div className="detail-meta-item">
          <span>Cards</span>
          <strong>
            {cardStats.total} ({cardStats.drafted} drafted, {cardStats.minted}{" "}
            minted)
          </strong>
        </div>
      </div>

      <div className="admin-subsection" style={{ marginTop: 24 }}>
        <h3 className="admin-subsection-title">Email & Communications</h3>
        <div className="admin-inline-form admin-inline-form--spaced">
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenEmailModal}
            disabled={isSendEmailPending || !user.email}
          >
            Send Email
          </button>
          {!user.activated ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (user.email) {
                  onSetEmailConfirmAction({
                    type: "resend-activation",
                    email: user.email,
                  });
                }
              }}
              disabled={isResendActivationPending || !user.email}
            >
              {isResendActivationPending ? "Sending..." : "Resend Activation"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (user.email) {
                onSetEmailConfirmAction({
                  type: "resend-password-reset",
                  email: user.email,
                });
              }
            }}
            disabled={isResendPasswordResetPending || !user.email}
          >
            {isResendPasswordResetPending
              ? "Sending..."
              : "Resend Password Reset"}
          </button>
        </div>

        {!user.email ? (
          <p className="dash-loading" style={{ marginTop: 10 }}>
            No email address is available for this user.
          </p>
        ) : null}
      </div>

      {emailModal && user.email ? (
        <div className="admin-modal-overlay">
          <div className="admin-modal" role="dialog" aria-modal="true">
            <div className="admin-modal-header">
              <h3>Send Email</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={onCloseEmailModal}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-modal-section">
                <label htmlFor="admin-email-recipient">To</label>
                <input
                  id="admin-email-recipient"
                  type="text"
                  value={user.email}
                  readOnly
                />
              </div>

              <div className="admin-modal-section">
                <label htmlFor="admin-email-subject">Subject</label>
                <input
                  id="admin-email-subject"
                  type="text"
                  value={emailSubject}
                  onChange={(event) => onEmailSubjectChange(event.target.value)}
                  placeholder="An Email from Legendary Profiles"
                />
              </div>

              <div className="admin-modal-section" style={{ marginTop: 12 }}>
                <label htmlFor="admin-email-title">Title</label>
                <input
                  id="admin-email-title"
                  type="text"
                  value={emailTitle}
                  onChange={(event) => onEmailTitleChange(event.target.value)}
                  placeholder="Email Title Goes Here"
                />
              </div>

              <div className="admin-modal-section" style={{ marginTop: 12 }}>
                <label htmlFor="admin-email-html-body-editor">Message</label>
                <div
                  className="admin-wysiwyg-toolbar"
                  role="toolbar"
                  aria-label="Email formatting toolbar"
                >
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => onApplyEmailFormat("bold")}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => onApplyEmailFormat("italic")}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => onApplyEmailFormat("underline")}
                  >
                    U
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => onApplyEmailFormat("insertUnorderedList")}
                  >
                    List
                  </button>
                </div>
                <div
                  id="admin-email-html-body-editor"
                  ref={emailEditorRef}
                  className="admin-wysiwyg-editor"
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Type your message here..."
                  onInput={onSyncEmailHtmlBody}
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onCloseEmailModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onSendEmail}
                disabled={
                  isSendEmailPending ||
                  !emailSubject.trim() ||
                  !emailTitle.trim() ||
                  !emailHtmlBody.replace(/<[^>]+>/g, "").trim()
                }
              >
                {isSendEmailPending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {emailConfirmAction ? (
        <div className="admin-modal-overlay">
          <div
            className="admin-modal admin-modal--small"
            role="dialog"
            aria-modal="true"
          >
            <div className="admin-modal-header">
              <h3>Confirm Email Action</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => onSetEmailConfirmAction(null)}
              >
                ✕
              </button>
            </div>
            <div className="admin-modal-body">
              {emailConfirmAction.type === "resend-activation" ? (
                <p style={{ margin: 0 }}>
                  Resend activation email to{" "}
                  <strong>{emailConfirmAction.email}</strong>?
                </p>
              ) : null}

              {emailConfirmAction.type === "resend-password-reset" ? (
                <p style={{ margin: 0 }}>
                  Resend password reset email to{" "}
                  <strong>{emailConfirmAction.email}</strong>?
                </p>
              ) : null}
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onSetEmailConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onConfirmEmailAction}
                disabled={
                  isSendEmailPending ||
                  isResendActivationPending ||
                  isResendPasswordResetPending
                }
              >
                {isSendEmailPending ||
                isResendActivationPending ||
                isResendPasswordResetPending
                  ? "Sending..."
                  : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
