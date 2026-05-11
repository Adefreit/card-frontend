import { useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/auth-context";
import {
  extendAdminUserSubscription,
  resendAdminActivationEmail,
  resendAdminPasswordReset,
  sendAdminUserEmail,
  getAdminCardArtifact,
  getAdminOrders,
  getAdminUser,
  getAdminUserCards,
  getAdminUserPermissions,
  grantAdminUserPermission,
  mintAdminCard,
  revokeAdminUserPermission,
  unmintAdminCard,
  type AdminCardArtifactType,
} from "../api";
import AdminUserCardsTab from "../components/user-detail/AdminUserCardsTab";
import { AdminUserDetailContextProvider } from "../components/user-detail/AdminUserDetailContext";
import AdminUserDetailTabs from "../components/user-detail/AdminUserDetailTabs";
import AdminUserOrdersTab from "../components/user-detail/AdminUserOrdersTab";
import AdminUserPermissionsTab from "../components/user-detail/AdminUserPermissionsTab";
import AdminUserSubscriptionTab from "../components/user-detail/AdminUserSubscriptionTab";
import AdminUserSummaryTab from "../components/user-detail/AdminUserSummaryTab";
import type {
  CardConfirmAction,
  DetailTab,
  EmailConfirmAction,
} from "../components/user-detail/types";

const COMMON_PERMISSIONS = ["ADMIN", "FOUNDER"] as const;

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
  const [cardConfirmAction, setCardConfirmAction] =
    useState<CardConfirmAction | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailTitle, setEmailTitle] = useState("");
  const [emailHtmlBody, setEmailHtmlBody] = useState("");
  const [emailConfirmAction, setEmailConfirmAction] =
    useState<EmailConfirmAction | null>(null);
  const [loadedCardPreviews, setLoadedCardPreviews] = useState<Set<string>>(
    new Set(),
  );
  const emailEditorRef = useRef<HTMLDivElement | null>(null);

  const canLoad = Boolean(userId);

  function handleCardPreviewHover(cardId: string) {
    setLoadedCardPreviews((prev) => {
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });
  }

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

  const ordersQuery = useQuery({
    queryKey: ["admin", "user", userId, "orders"],
    queryFn: () => getAdminOrders({ userID: userId as string, pageSize: 50 }),
    enabled: canLoad && activeTab === "orders",
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
      closeSubscriptionModal();
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
    mutationFn: ({
      toAddress,
      subject,
      title,
      htmlBody,
    }: {
      toAddress: string;
      subject: string;
      title: string;
      htmlBody: string;
    }) => sendAdminUserEmail(toAddress, subject, title, htmlBody),
    onSuccess: async () => {
      setMutationMessage("Email sent successfully.");
      resetEmailComposer();
      setEmailConfirmAction(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => {
      setMutationMessage("Failed to send email.");
    },
  });

  const resendActivationMutation = useMutation({
    mutationFn: (email: string) => resendAdminActivationEmail(email),
    onSuccess: async () => {
      setMutationMessage("Activation email sent successfully.");
      setEmailConfirmAction(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => {
      setMutationMessage("Failed to send activation email.");
    },
  });

  const resendPasswordResetMutation = useMutation({
    mutationFn: (email: string) => resendAdminPasswordReset(email),
    onSuccess: async () => {
      setMutationMessage("Password reset email sent successfully.");
      setEmailConfirmAction(null);
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

  const resetSubscriptionForm = () => {
    setSubscriptionConfirm(false);
    setSubscriptionDays(30);
    setSubscriptionCustomDate("");
    setSubscriptionUseCustom(false);
  };

  const closeSubscriptionModal = () => {
    setSubscriptionModal(false);
    resetSubscriptionForm();
  };

  const resetEmailComposer = () => {
    setEmailModal(false);
    setEmailSubject("");
    setEmailTitle("");
    setEmailHtmlBody("");
    if (emailEditorRef.current) {
      emailEditorRef.current.innerHTML = "";
    }
  };

  const syncEmailHtmlBody = () => {
    setEmailHtmlBody(emailEditorRef.current?.innerHTML ?? "");
  };

  const applyEmailFormat = (
    command: "bold" | "italic" | "underline" | "insertUnorderedList",
  ) => {
    document.execCommand(command);
    syncEmailHtmlBody();
    emailEditorRef.current?.focus();
  };

  const handleConfirmEmailAction = () => {
    if (!emailConfirmAction) {
      return;
    }

    if (emailConfirmAction.type === "resend-activation") {
      resendActivationMutation.mutate(emailConfirmAction.email);
      return;
    }

    resendPasswordResetMutation.mutate(emailConfirmAction.email);
  };

  const handleSendEmail = () => {
    if (!userQuery.data?.email) {
      return;
    }

    sendEmailMutation.mutate({
      toAddress: userQuery.data.email,
      subject: emailSubject.trim(),
      title: emailTitle.trim(),
      htmlBody: emailHtmlBody,
    });
  };

  const handleConfirmCardAction = () => {
    if (!cardConfirmAction) {
      return;
    }

    cardActionMutation.mutate(cardConfirmAction);
  };

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
        <AdminUserDetailContextProvider
          value={{
            permissions,
            commonPermissions: COMMON_PERMISSIONS,
            permissionInput,
            currentUserId,
            targetUserId: userId,
            isGrantPending: grantPermissionMutation.isPending,
            isRevokePending: revokePermissionMutation.isPending,
            onPermissionInputChange: setPermissionInput,
            onGrantPermission: (permission) =>
              grantPermissionMutation.mutate(permission),
            onRevokePermission: (permission) =>
              revokePermissionMutation.mutate(permission),
            emailModal,
            emailSubject,
            emailTitle,
            emailHtmlBody,
            emailConfirmAction,
            emailEditorRef,
            isSendEmailPending: sendEmailMutation.isPending,
            isResendActivationPending: resendActivationMutation.isPending,
            isResendPasswordResetPending: resendPasswordResetMutation.isPending,
            onOpenEmailModal: () => setEmailModal(true),
            onCloseEmailModal: resetEmailComposer,
            onEmailSubjectChange: setEmailSubject,
            onEmailTitleChange: setEmailTitle,
            onSyncEmailHtmlBody: syncEmailHtmlBody,
            onApplyEmailFormat: applyEmailFormat,
            onSendEmail: handleSendEmail,
            onSetEmailConfirmAction: setEmailConfirmAction,
            onConfirmEmailAction: handleConfirmEmailAction,
            subscriptionModal,
            subscriptionDays,
            subscriptionCustomDate,
            subscriptionUseCustom,
            subscriptionConfirm,
            isExtendPending: extendSubscriptionMutation.isPending,
            onOpenSubscriptionModal: () => setSubscriptionModal(true),
            onCloseSubscriptionModal: closeSubscriptionModal,
            onSetSubscriptionDays: setSubscriptionDays,
            onSetSubscriptionCustomDate: setSubscriptionCustomDate,
            onSetSubscriptionUseCustom: setSubscriptionUseCustom,
            onSetSubscriptionConfirm: setSubscriptionConfirm,
            onExtendSubscription: () =>
              extendSubscriptionMutation.mutate(subscriptionDays),
            loadedCardPreviews,
            cardConfirmAction,
            isArtifactPending: artifactMutation.isPending,
            isCardActionPending: cardActionMutation.isPending,
            onHoverCardPreview: handleCardPreviewHover,
            onDownloadArtifact: (cardId, type) =>
              artifactMutation.mutate({ cardId, type }),
            onRequestCardAction: setCardConfirmAction,
            onClearCardAction: () => setCardConfirmAction(null),
            onConfirmCardAction: handleConfirmCardAction,
          }}
        >
          <AdminUserDetailTabs activeTab={activeTab} onChange={setActiveTab} />

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
            <AdminUserSummaryTab user={userQuery.data} cardStats={cardStats} />
          ) : null}

          {activeTab === "permissions" ? <AdminUserPermissionsTab /> : null}

          {activeTab === "subscription" && userQuery.data ? (
            <AdminUserSubscriptionTab user={userQuery.data} />
          ) : null}

          {activeTab === "cards" ? (
            <AdminUserCardsTab cards={cardsQuery.data?.cards ?? []} />
          ) : null}

          {activeTab === "orders" ? (
            <AdminUserOrdersTab
              userId={userId}
              orders={ordersQuery.data?.orders ?? []}
              isLoading={ordersQuery.isLoading}
              isError={ordersQuery.isError}
            />
          ) : null}
        </AdminUserDetailContextProvider>
      </section>
    </div>
  );
}
