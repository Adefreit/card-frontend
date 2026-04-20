import { apiClient } from "../../lib/http";

export type TransactionType = "mint" | "purchase_item" | "subscription";
export type CardPackProductId =
  | "card_pack_50"
  | "card_pack_100"
  | "card_pack_500"
  | "card_pack_1000";

export interface StripePriceSummary {
  priceId: string;
  unitAmountCents: number;
  currency: string;
}

export interface SubscriptionTypePricing {
  id: string;
  name: string;
  monthlyMintLimit: number;
  mintDiscountPercent: number;
  maxDraftsSubscribed: number;
  prices: {
    monthly: StripePriceSummary | null;
    yearly: StripePriceSummary | null;
  };
}

export interface PricingResponse {
  mint: StripePriceSummary;
  cardPacks: Record<CardPackProductId, StripePriceSummary>;
  subscriptionTypes: SubscriptionTypePricing[];
}

export interface MintTransactionPayload {
  cardId: string;
}

export interface PurchaseItemTransactionLine {
  itemType: string;
  productId: string;
  quantity: number;
  variantId?: string;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionTransactionPayload {
  subscriptionType: string;
  interval: "month" | "year";
}

export interface CreateTransactionPayload {
  transactionType: TransactionType;
  idempotencyKey: string;
  currency: string;
  mint?: MintTransactionPayload;
  items?: PurchaseItemTransactionLine[];
  subscription?: SubscriptionTransactionPayload;
  metadata?: Record<string, unknown>;
}

export interface CreateTransactionResponse {
  order?: {
    id: string;
    order_type?: string;
    status?: string;
    [key: string]: unknown;
  };
  stripe?: {
    checkoutSessionID?: string;
    checkoutURL?: string;
  };
}

export interface TransactionRecord {
  id: string;
  order_type?: string;
  status?: string;
  create_time?: string;
  cancel_at_period_end?: boolean;
  cancellation_requested_at?: string | null;
  cancellation_effective_at?: string | null;
  cancellation_source?: string | null;
  [key: string]: unknown;
}

interface ApiMessageResponse {
  response: string;
}

export function createIdempotencyKey() {
  return crypto.randomUUID();
}

export function getCheckoutRedirectUrl(
  response: CreateTransactionResponse,
): string | null {
  return response.stripe?.checkoutURL ?? null;
}

export async function createTransaction(payload: CreateTransactionPayload) {
  const { data } = await apiClient.post<CreateTransactionResponse>(
    "/v1/transactions",
    payload,
  );
  return data;
}

export async function getTransactions() {
  const { data } = await apiClient.get<TransactionRecord[]>("/v1/transactions");
  return data;
}

export async function cancelTransaction(id: string) {
  const { data } = await apiClient.post<ApiMessageResponse>(
    `/v1/transactions/${id}/cancel`,
  );
  return data;
}

export async function resumeTransaction(id: string) {
  const { data } = await apiClient.post<ApiMessageResponse>(
    `/v1/transactions/${id}/resume`,
  );
  return data;
}

export async function getPricing() {
  const { data } = await apiClient.get<PricingResponse>("/v1/pricing");
  return data;
}
