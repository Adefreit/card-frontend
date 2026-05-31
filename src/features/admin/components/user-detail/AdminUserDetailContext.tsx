/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";
import type { ReactNode, RefObject } from "react";
import type { AdminCardArtifactType } from "../../api";
import type { CardConfirmAction, EmailConfirmAction } from "./types";

type AdminUserDetailContextValue = {
  permissions: string[];
  commonPermissions: readonly string[];
  permissionInput: string;
  currentUserId?: string | null;
  targetUserId: string;
  isGrantPending: boolean;
  isRevokePending: boolean;
  onPermissionInputChange: (value: string) => void;
  onGrantPermission: (permission: string) => void;
  onRevokePermission: (permission: string) => void;
  emailModal: boolean;
  emailSubject: string;
  emailTitle: string;
  emailHtmlBody: string;
  emailConfirmAction: EmailConfirmAction | null;
  emailEditorRef: RefObject<HTMLDivElement | null>;
  isSendEmailPending: boolean;
  isResendActivationPending: boolean;
  isResendPasswordResetPending: boolean;
  onOpenEmailModal: () => void;
  onCloseEmailModal: () => void;
  onEmailSubjectChange: (value: string) => void;
  onEmailTitleChange: (value: string) => void;
  onSyncEmailHtmlBody: () => void;
  onApplyEmailFormat: (
    command: "bold" | "italic" | "underline" | "insertUnorderedList",
  ) => void;
  onSendEmail: () => void;
  onSetEmailConfirmAction: (action: EmailConfirmAction | null) => void;
  onConfirmEmailAction: () => void;
  subscriptionModal: boolean;
  subscriptionDays: number;
  subscriptionCustomDate: string;
  subscriptionUseCustom: boolean;
  subscriptionConfirm: boolean;
  isExtendPending: boolean;
  onOpenSubscriptionModal: () => void;
  onCloseSubscriptionModal: () => void;
  onSetSubscriptionDays: (days: number) => void;
  onSetSubscriptionCustomDate: (value: string) => void;
  onSetSubscriptionUseCustom: (value: boolean) => void;
  onSetSubscriptionConfirm: (value: boolean) => void;
  onExtendSubscription: () => void;
  loadedCardPreviews: Set<string>;
  cardConfirmAction: CardConfirmAction | null;
  isArtifactPending: boolean;
  isCardActionPending: boolean;
  onHoverCardPreview: (cardId: string) => void;
  onDownloadArtifact: (cardId: string, type: AdminCardArtifactType) => void;
  onRequestCardAction: (action: CardConfirmAction) => void;
  onClearCardAction: () => void;
  onConfirmCardAction: () => void;
};

const AdminUserDetailContext =
  createContext<AdminUserDetailContextValue | null>(null);

type AdminUserDetailContextProviderProps = {
  value: AdminUserDetailContextValue;
  children: ReactNode;
};

export function AdminUserDetailContextProvider({
  value,
  children,
}: AdminUserDetailContextProviderProps) {
  return (
    <AdminUserDetailContext.Provider value={value}>
      {children}
    </AdminUserDetailContext.Provider>
  );
}

export function useAdminUserDetailContext() {
  const context = useContext(AdminUserDetailContext);
  if (!context) {
    throw new Error(
      "useAdminUserDetailContext must be used within AdminUserDetailContextProvider",
    );
  }

  return context;
}
