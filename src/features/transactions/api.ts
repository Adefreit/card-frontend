import { apiClient } from "../../lib/http";

export type TransactionType = "mint" | "purchase_item" | "subscription";

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
  interval: "month" | "year";
}

export interface CreateTransactionPayload {
  transactionType: TransactionType;
  idempotencyKey: string;
  currency: string;
  mint?: MintTransactionPayload;
  items?: PurchaseItemTransactionLine[];
  subscription?: SubscriptionTransactionPayload;
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
