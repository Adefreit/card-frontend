import { apiClient } from "../../lib/http";

export interface AdminHealthResponse {
  response: string;
  timestamp: string;
}

export interface AdminUserRecord {
  id: string;
  email?: string;
  activated?: boolean;
  account_subscription_until?: string | null;
  subscription_type?: string | null;
  settings?: Record<string, unknown>;
  permissions?: string[];
}

export interface AdminUsersResponse {
  users: AdminUserRecord[];
  page: number;
  pageSize: number;
}

export interface AdminUserPermissionsResponse {
  userID: string;
  permissions: string[];
}

export interface AdminUserCardRecord {
  id: string;
  user_id?: string;
  minted?: boolean;
  minted_at?: string | null;
  create_time?: string;
  last_render?: string | null;
  last_proof?: string | null;
  data?: {
    title?: string;
    subtitle?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AdminUserCardsResponse {
  userID: string;
  cards: AdminUserCardRecord[];
}

export type AdminCardArtifactType = "preview" | "proof";

export interface AdminCardArtifactResponse {
  cardID: string;
  userID: string;
  artifactType: AdminCardArtifactType;
  url: string;
}

export interface AdminExtendSubscriptionResponse {
  response: string;
  account_subscription_until: string;
}

export interface AdminCardActionResponse {
  response: string;
  card: Record<string, unknown>;
}

interface AdminUsersQuery {
  q?: string;
  userID?: string;
  email?: string;
  page?: number;
  pageSize?: number;
}

function toParams(values: Record<string, unknown>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  return params;
}

export async function getAdminHealth() {
  const { data } = await apiClient.get<AdminHealthResponse>("/v1/admin/health");
  return data;
}

export async function getAdminUsers(query: AdminUsersQuery) {
  const { data } = await apiClient.get<AdminUsersResponse>("/v1/admin/users", {
    params: toParams(query as Record<string, unknown>),
  });
  return data;
}

export async function getAdminUser(userId: string) {
  const { data } = await apiClient.get<AdminUserRecord>(
    `/v1/admin/users/${userId}`,
  );
  return data;
}

export async function getAdminUserPermissions(userId: string) {
  const { data } = await apiClient.get<AdminUserPermissionsResponse>(
    `/v1/admin/users/${userId}/permissions`,
  );
  return data;
}

export async function grantAdminUserPermission(
  userId: string,
  permission: string,
) {
  const { data } = await apiClient.post<AdminUserPermissionsResponse>(
    `/v1/admin/users/${userId}/permissions`,
    { permission },
  );
  return data;
}

export async function revokeAdminUserPermission(
  userId: string,
  permission: string,
) {
  const { data } = await apiClient.delete<AdminUserPermissionsResponse>(
    `/v1/admin/users/${userId}/permissions/${permission}`,
  );
  return data;
}

export async function extendAdminUserSubscription(
  userId: string,
  days: number,
) {
  const { data } = await apiClient.post<AdminExtendSubscriptionResponse>(
    `/v1/admin/users/${userId}/extend-subscription`,
    { days },
  );
  return data;
}

export async function getAdminUserCards(userId: string) {
  const { data } = await apiClient.get<AdminUserCardsResponse>(
    `/v1/admin/users/${userId}/cards`,
  );
  return data;
}

export async function getAdminCardArtifact(
  cardId: string,
  artifactType: AdminCardArtifactType,
) {
  const { data } = await apiClient.get<AdminCardArtifactResponse>(
    `/v1/admin/cards/${cardId}/artifacts/${artifactType}`,
  );
  return data;
}

export async function mintAdminCard(cardId: string) {
  const { data } = await apiClient.post<AdminCardActionResponse>(
    `/v1/admin/cards/${cardId}/mint`,
  );
  return data;
}

export async function unmintAdminCard(cardId: string) {
  const { data } = await apiClient.post<AdminCardActionResponse>(
    `/v1/admin/cards/${cardId}/unmint`,
  );
  return data;
}

export interface AdminOrderItem {
  id: string;
  create_time?: string;
  order_id?: string;
  item_type?: "card_pack" | "deck" | "game_pack" | "other" | "mint";
  product_id?: string;
  variant_id?: string | null;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  quantity?: number;
  unit_price_cents?: number;
  line_subtotal_cents?: number;
  line_tax_cents?: number;
  line_total_cents?: number;
  print_options?: Record<string, unknown>;
  [key: string]: unknown;
}

export type AdminFulfillmentStage =
  | "pending"
  | "preparing"
  | "on_hold"
  | "complete"
  | "cancelled";

export interface AdminOrderRecord {
  id: string;
  user_id?: string;
  update_time?: string;
  status?: string;
  currency?: string;
  subtotal_cents?: number;
  tax_cents?: number;
  shipping_cents?: number;
  total_cents?: number;
  refund_total_cents?: number;
  order_type?: string;
  payment_provider?: string;
  provider_checkout_id?: string | null;
  provider_payment_intent_id?: string | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  cancel_at_period_end?: boolean;
  cancellation_requested_at?: string | null;
  cancellation_effective_at?: string | null;
  cancellation_source?: string | null;
  subscription_interval?: "month" | "year" | null;
  subscription_type?: string | null;
  mint_card_id?: string | null;
  fulfillment_stage?: AdminFulfillmentStage;
  fulfillment_update_time?: string | null;
  fulfillment_actor_user_id?: string | null;
  idempotency_key?: string | null;
  shipping_address?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  create_time?: string;
  items?: AdminOrderItem[];
}

export interface AdminOrderFulfillmentNote {
  id: string;
  create_time: string;
  order_id: string;
  actor_user_id: string | null;
  from_stage: AdminFulfillmentStage | null;
  to_stage: AdminFulfillmentStage;
  note: string | null;
  metadata: Record<string, unknown>;
}

export interface AdminSafeUser {
  id: string;
  create_time?: string | Date;
  email: string;
  activated: boolean;
  account_subscription_until: string | Date;
  subscription_type: string;
  settings?: Record<string, unknown>;
}

export interface AdminOrderRelatedCard {
  cardID: string;
  card?: Record<string, unknown>;
  artifacts: {
    preview: string | null;
    proof: string | null;
  };
}

export interface AdminOrderDetailsResponse {
  order: AdminOrderRecord;
  user: AdminSafeUser | null;
  cards: AdminOrderRelatedCard[];
  fulfillmentNotes: AdminOrderFulfillmentNote[];
}

export interface AdminOrdersResponse {
  orders: AdminOrderRecord[];
  page: number;
  pageSize: number;
}

interface AdminOrdersQuery {
  page?: number;
  pageSize?: number;
  userID?: string;
  orderType?: string;
  fulfillmentStage?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export async function getAdminOrders(query: AdminOrdersQuery) {
  const { data } = await apiClient.get<AdminOrdersResponse>(
    "/v1/admin/orders",
    { params: toParams(query as Record<string, unknown>) },
  );
  return data;
}

export async function getAdminOrder(orderId: string) {
  const { data } = await apiClient.get<AdminOrderDetailsResponse>(
    `/v1/admin/orders/${orderId}`,
  );
  return data;
}

export async function updateAdminOrderFulfillmentStage(
  orderId: string,
  fulfillmentStage: AdminFulfillmentStage,
  note?: string,
  metadata?: Record<string, unknown>,
) {
  const payload: {
    fulfillmentStage: AdminFulfillmentStage;
    note?: string;
    metadata?: Record<string, unknown>;
  } = { fulfillmentStage };

  if (typeof note === "string" && note.trim().length > 0) {
    payload.note = note.trim();
  }

  if (metadata && Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  const { data } = await apiClient.post<AdminOrderRecord>(
    `/v1/admin/orders/${orderId}/fulfillment-stage`,
    payload,
  );
  return data;
}

export interface AdminEmailResponse {
  response: string;
}

export async function sendAdminUserEmail(
  userId: string,
  subject: string,
  body: string,
) {
  const { data } = await apiClient.post<AdminEmailResponse>(
    `/v1/admin/users/${userId}/send-email`,
    { subject, body },
  );
  return data;
}

export async function resendAdminActivationEmail(userId: string) {
  const { data } = await apiClient.post<AdminEmailResponse>(
    `/v1/admin/users/${userId}/resend-activation`,
  );
  return data;
}

export async function resendAdminPasswordReset(userId: string) {
  const { data } = await apiClient.post<AdminEmailResponse>(
    `/v1/admin/users/${userId}/resend-password-reset`,
  );
  return data;
}

export async function refundAdminOrder(
  orderId: string,
  refundCents: number,
  reason: string,
) {
  const { data } = await apiClient.post<unknown>(
    `/v1/transactions/${orderId}/refund`,
    { refundCents, reason },
  );
  return data;
}
