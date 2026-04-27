import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/auth-context";
import {
  extendAdminUserSubscription,
  resendAdminActivationEmail,
  resendAdminPasswordReset,
  sendAdminUserEmail,
  getAdminCardArtifact,
  getAdminUser,
  getAdminUserCards,
  getAdminUserPermissions,
  grantAdminUserPermission,
  mintAdminCard,
  revokeAdminUserPermission,
  unmintAdminCard,
  type AdminCardArtifactType,
} from "../api";

type DetailTab = "summary" | "permissions" | "subscription" | "cards";

const COMMON_PERMISSIONS = ["ADMIN", "FOUNDER"] as const;

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

function isSubscriptionActive(value?: string | null) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() > Date.now();
}

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useAuth();
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const [permissionInput, setPermissionInput] = useState("ADMIN");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [subscriptionModal, setSubscriptionModal] = useState(false);
  const [subscriptionDays, setSubscriptionDays] = useState(30);
  const [subscriptionCustomDate, setSubscriptionCustomDate] = useState("");
  const [subscriptionUseCustom, setSubscriptionUseCustom] = useState(false);
  const [subscriptionConfirm, setSubscriptionConfirm] = useState(false);
  const [cardConfirmAction, setCardConfirmAction] = useState<{
    cardId: string;
    action: "mint" | "unmint";
  } | null>(null);

  const canLoad = Boolean(userId);

  const userQuery = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => getAdminUser(userId as string),
    enabled: canLoad,
  });

  const permissionsQuery = useQuery({
    queryKey: ["admin", "user", userId, "permissions"],
    queryFn: () => getAdminUserPermissions(userId as string),
    enabled: canLoad,
  });

  const cardsQuery = useQuery({
    queryKey: ["admin", "user", userId, "cards"],
    queryFn: () => getAdminUserCards(userId as string),
    enabled: canLoad,
  });

  const refreshUserData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "user", userId, "permissions"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "user", userId, "cards"],
      }),
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
    ]);
  };

  const grantPermissionMutation = useMutation({
    mutationFn: (permission: string) =>
      grantAdminUserPermission(userId as string, permission),
    onSuccess: async () => {
      setMutationMessage("Permission granted.");
      await refreshUserData();
      setPermissionInput("ADMIN");
    },
    onError: () => {
      setMutationMessage("Failed to grant permission.");
    },
  });

  const revokePermissionMutation = useMutation({
    mutationFn: (permission: string) =>
      revokeAdminUserPermission(userId as string, permission),
    onSuccess: async () => {
      setMutationMessage("Permission revoked.");
      await refreshUserData();
    },
    onError: () => {
      setMutationMessage("Failed to revoke permission.");
    },
  });

  const extendSubscriptionMutation = useMutation({
    mutationFn: (days: number) =>
      extendAdminUserSubscription(userId as string, days),
    onSuccess: async () => {
      setMutationMessage("Subscription extended.");
      await refreshUserData();
      setSubscriptionModal(false);
      setSubscriptionConfirm(false);
      setSubscriptionDays(30);
      setSubscriptionCustomDate("");
      setSubscriptionUseCustom(false);
    },
    onError: () => {
      setMutationMessage("Failed to extend subscription.");
    },
  });

  const cardActionMutation = useMutation({
    mutationFn: ({
      cardId,
      action,
    }: {
      cardId: string;
      action: "mint" | "unmint";
    }) => {
      if (action === "mint") {
        return mintAdminCard(cardId);
      }

      return unmintAdminCard(cardId);
    },
    onSuccess: async () => {
      setMutationMessage("Card updated.");
      await refreshUserData();
      setCardConfirmAction(null);
    },
    onError: () => {
      setMutationMessage("Failed to update card state.");
    },
  });

  const artifactMutation = useMutation({
    mutationFn: ({
      cardId,
      type,
    }: {
      cardId: string;
      type: AdminCardArtifactType;
    }) => getAdminCardArtifact(cardId, type),
    onSuccess: (data) => {
      window.open(data.url, "_blank", "noopener,noreferrer");
    },
    onError: () => {
      setMutationMessage("Unable to load artifact URL.");
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: () =>
      sendAdminUserEmail(
        userId as string,
        "Account Information",
        "Hello,\n\nThis is an administrative message regarding your account.\n\nBest regards",
      ),
    onSuccess: async () => {
      setMutationMessage("Email sent successfully.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => {
      setMutationMessage("Failed to send email.");
    },
  });

  const resendActivationMutation = useMutation({
    mutationFn: () => resendAdminActivationEmail(userId as string),
    onSuccess: async () => {
      setMutationMessage("Activation email sent successfully.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => {
      setMutationMessage("Failed to send activation email.");
    },
  });

  const resendPasswordResetMutation = useMutation({
    mutationFn: () => resendAdminPasswordReset(userId as string),
    onSuccess: async () => {
      setMutationMessage("Password reset email sent successfully.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => {
      setMutationMessage("Failed to send password reset email.");
    },
  });

  const permissions = useMemo(
    () => permissionsQuery.data?.permissions ?? [],
    [permissionsQuery.data?.permissions],
  );

  const cardStats = useMemo(() => {
    const cards = cardsQuery.data?.cards ?? [];
    return {
      total: cards.length,
      drafted: cards.filter((c) => !c.minted).length,
      minted: cards.filter((c) => c.minted).length,
    };
  }, [cardsQuery.data?.cards]);

  if (!userId) {
    return <Navigate to="/app/admin/users" replace />;
  }

  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Admin User Detail</h1>
          <p className="content-hero-copy">
            Review account state and manage permissions, subscription, and
            cards.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/admin/users">
          Back to Users
        </Link>
      </section>

      <section className="dash-panel admin-card">
        <div
          className="admin-tabs"
          role="tablist"
          aria-label="Admin user detail tabs"
        >
          <button
            type="button"
            className={`admin-tab${activeTab === "summary" ? " is-active" : ""}`}
            onClick={() => setActiveTab("summary")}
            aria-selected={activeTab === "summary"}
          >
            Summary
          </button>
          <button
            type="button"
            className={`admin-tab${activeTab === "permissions" ? " is-active" : ""}`}
            onClick={() => setActiveTab("permissions")}
            aria-selected={activeTab === "permissions"}
          >
            Permissions
          </button>
          <button
            type="button"
            className={`admin-tab${activeTab === "subscription" ? " is-active" : ""}`}
            onClick={() => setActiveTab("subscription")}
            aria-selected={activeTab === "subscription"}
          >
            Subscription
          </button>
          <button
            type="button"
            className={`admin-tab${activeTab === "cards" ? " is-active" : ""}`}
            onClick={() => setActiveTab("cards")}
            aria-selected={activeTab === "cards"}
          >
            Cards
          </button>
        </div>

        {mutationMessage ? (
          <p className="alert-success">{mutationMessage}</p>
        ) : null}

        {(userQuery.isLoading ||
          permissionsQuery.isLoading ||
          cardsQuery.isLoading) && (
          <p className="dash-loading">Loading user data...</p>
        )}

        {userQuery.isError ? (
          <p className="alert-error">Failed to load user detail.</p>
        ) : null}

        {activeTab === "summary" && userQuery.data ? (
          <div className="admin-tab-panel">
            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <span>User ID</span>
                <strong>{userQuery.data.id}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Email</span>
                <strong>{userQuery.data.email ?? "-"}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Activated</span>
                <strong>{userQuery.data.activated ? "Yes" : "No"}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Subscription Status</span>
                <strong>
                  {isSubscriptionActive(
                    userQuery.data.account_subscription_until,
                  )
                    ? "Active subscription"
                    : "Free plan"}
                </strong>
              </div>
              <div className="detail-meta-item">
                <span>Subscription Until</span>
                <strong>
                  {formatDate(userQuery.data.account_subscription_until)}
                </strong>
              </div>
              <div className="detail-meta-item">
                <span>Cards</span>
                <strong>
                  {cardStats.total} ({cardStats.drafted} drafted,{" "}
                  {cardStats.minted} minted)
                </strong>
              </div>
            </div>

            <div
              className="admin-inline-form admin-inline-form--spaced"
              style={{ marginTop: 16 }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => sendEmailMutation.mutate()}
                disabled={sendEmailMutation.isPending}
              >
                {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => resendActivationMutation.mutate()}
                disabled={resendActivationMutation.isPending}
              >
                {resendActivationMutation.isPending
                  ? "Sending..."
                  : "Resend Activation"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => resendPasswordResetMutation.mutate()}
                disabled={resendPasswordResetMutation.isPending}
              >
                {resendPasswordResetMutation.isPending
                  ? "Sending..."
                  : "Resend Password Reset"}
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "permissions" ? (
          <div className="admin-stack admin-tab-panel">
            <div className="admin-inline-form admin-inline-form--spaced">
              <input
                list="permission-suggestions"
                value={permissionInput}
                onChange={(event) => setPermissionInput(event.target.value)}
                placeholder="Permission e.g. ADMIN"
              />
              <datalist id="permission-suggestions">
                {COMMON_PERMISSIONS.map((permission) => (
                  <option key={permission} value={permission} />
                ))}
              </datalist>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const trimmed = permissionInput.trim().toUpperCase();
                  if (!trimmed) {
                    return;
                  }

                  grantPermissionMutation.mutate(trimmed);
                }}
                disabled={grantPermissionMutation.isPending}
              >
                {grantPermissionMutation.isPending ? "Granting..." : "Grant"}
              </button>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: 16 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          color: "var(--ui-muted)",
                          textAlign: "center",
                        }}
                      >
                        No permissions assigned
                      </td>
                    </tr>
                  ) : (
                    permissions.map((permission) => {
                      const isSelfAdminRemovalBlocked =
                        permission.toUpperCase() === "ADMIN" &&
                        currentUserId === userId;

                      return (
                        <tr key={permission}>
                          <td>
                            <strong>{permission}</strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary btn-xs"
                              onClick={() =>
                                revokePermissionMutation.mutate(permission)
                              }
                              disabled={
                                revokePermissionMutation.isPending ||
                                isSelfAdminRemovalBlocked
                              }
                              title={
                                isSelfAdminRemovalBlocked
                                  ? "Cannot remove your own ADMIN permission"
                                  : undefined
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "subscription" && userQuery.data ? (
          <div className="admin-stack admin-tab-panel">
            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <span>Current Plan</span>
                <strong>
                  {isSubscriptionActive(
                    userQuery.data.account_subscription_until,
                  )
                    ? "Active subscription"
                    : "Free plan"}
                </strong>
              </div>
              <div className="detail-meta-item">
                <span>Subscription Until</span>
                <strong>
                  {formatDate(userQuery.data.account_subscription_until)}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => setSubscriptionModal(true)}
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
                      onClick={() => {
                        setSubscriptionModal(false);
                        setSubscriptionConfirm(false);
                        setSubscriptionDays(30);
                        setSubscriptionCustomDate("");
                        setSubscriptionUseCustom(false);
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="admin-modal-body">
                    {!subscriptionConfirm ? (
                      <>
                        <p
                          style={{ marginBottom: 16, color: "var(--ui-muted)" }}
                        >
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
                                  !subscriptionUseCustom &&
                                  subscriptionDays === days
                                    ? " is-selected"
                                    : ""
                                }`}
                                onClick={() => {
                                  setSubscriptionDays(days);
                                  setSubscriptionUseCustom(false);
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
                              onChange={(e) => {
                                setSubscriptionCustomDate(e.target.value);
                                if (e.target.value) {
                                  setSubscriptionUseCustom(true);
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
                        <p
                          style={{ color: "var(--ui-muted)", marginBottom: 12 }}
                        >
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
                          This action cannot be undone. The user's subscription
                          will be extended.
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
                          setSubscriptionConfirm(false);
                        } else {
                          setSubscriptionModal(false);
                          setSubscriptionDays(30);
                          setSubscriptionCustomDate("");
                          setSubscriptionUseCustom(false);
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
                          setSubscriptionConfirm(true);
                        } else {
                          extendSubscriptionMutation.mutate(subscriptionDays);
                        }
                      }}
                      disabled={
                        subscriptionUseCustom && !subscriptionCustomDate
                          ? true
                          : extendSubscriptionMutation.isPending
                      }
                    >
                      {subscriptionConfirm
                        ? extendSubscriptionMutation.isPending
                          ? "Extending..."
                          : "Confirm"
                        : "Next"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "cards" ? (
          cardsQuery.data?.cards?.length === 0 ? (
            <p className="dash-loading">No cards found for this user.</p>
          ) : (
            <div className="admin-table-wrap admin-tab-panel">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Download</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(cardsQuery.data?.cards ?? []).map((card) => {
                    const minted = Boolean(card.minted);
                    const previewSrc =
                      card.last_render ?? card.last_proof ?? null;

                    return (
                      <tr key={card.id} className="admin-card-row">
                        <td className="admin-card-row__title-cell admin-card-row__preview-parent">
                          <strong>{card.data?.title ?? "Untitled"}</strong>
                          <br />
                          <small>{card.id}</small>
                          {previewSrc ? (
                            <div className="admin-card-row__preview-tooltip">
                              <img
                                src={previewSrc}
                                alt={card.data?.title ?? "Card preview"}
                              />
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className={`admin-stage-badge admin-stage-badge--${
                              minted ? "delivered" : "pending"
                            }`}
                          >
                            {minted ? "Minted" : "Draft"}
                          </span>
                        </td>
                        <td>{formatDate(card.create_time)}</td>
                        <td>
                          <div className="admin-icon-buttons">
                            <button
                              type="button"
                              className="admin-icon-btn"
                              onClick={() =>
                                artifactMutation.mutate({
                                  cardId: card.id,
                                  type: "preview",
                                })
                              }
                              disabled={artifactMutation.isPending}
                              title="Download preview"
                            >
                              👁️
                            </button>
                            <button
                              type="button"
                              className="admin-icon-btn"
                              onClick={() =>
                                artifactMutation.mutate({
                                  cardId: card.id,
                                  type: "proof",
                                })
                              }
                              disabled={artifactMutation.isPending}
                              title="Download proof"
                            >
                              📄
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-secondary btn-xs"
                            onClick={() =>
                              setCardConfirmAction({
                                cardId: card.id,
                                action: minted ? "unmint" : "mint",
                              })
                            }
                            disabled={cardActionMutation.isPending}
                          >
                            {minted ? "Unmint" : "Mint"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {cardConfirmAction ? (
                <div className="admin-modal-overlay">
                  <div className="admin-modal admin-modal--small">
                    <div className="admin-modal-header">
                      <h3>
                        Confirm{" "}
                        {cardConfirmAction.action === "mint"
                          ? "Mint"
                          : "Unmint"}
                      </h3>
                      <button
                        type="button"
                        className="admin-modal-close"
                        onClick={() => setCardConfirmAction(null)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="admin-modal-body">
                      {cardConfirmAction.action === "mint" ? (
                        <p>
                          Minting this card will regenerate the proof artifact
                          and mark the card as minted. This is a permanent state
                          change.
                        </p>
                      ) : (
                        <p>
                          Unminting this card will remove the minted state,
                          delete stored artifacts, and regenerate a fresh
                          unminted preview. This action cannot be easily
                          reversed.
                        </p>
                      )}
                    </div>

                    <div className="admin-modal-footer">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setCardConfirmAction(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={
                          cardConfirmAction.action === "mint"
                            ? "btn-primary"
                            : "btn-danger"
                        }
                        onClick={() => {
                          cardActionMutation.mutate(cardConfirmAction);
                        }}
                        disabled={cardActionMutation.isPending}
                      >
                        {cardActionMutation.isPending
                          ? "Processing..."
                          : `Confirm ${cardConfirmAction.action === "mint" ? "Mint" : "Unmint"}`}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
