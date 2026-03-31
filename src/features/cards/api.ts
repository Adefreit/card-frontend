import { apiClient } from "../../lib/http";

export interface CardStats {
  green: number;
  yellow: number;
  red: number;
  purple: number;
  blue: number;
}

export interface CardData {
  title: string;
  subtitle: string;
  flavorText: string;
  backgroundImage?: string;
  foregroundImage?: string;
  backgroundImageUrl?: string;
  foregroundImageUrl?: string;
  customCss?: Record<string, string>;
  stats?: CardStats;
}

export interface CardRecord {
  id: string;
  user_id: string;
  template_id: string;
  create_time?: string;
  premium_expires_at?: string | null;
  data: CardData;
}

export interface CardCreatePayload {
  templateId: string;
  title: string;
  subtitle: string;
  flavorText: string;
  backgroundImage?: string;
  backgroundImageBase64?: string;
  backgroundImageMimeType?: string;
  foregroundImage?: string;
  foregroundImageBase64?: string;
  foregroundImageMimeType?: string;
  customCss?: Record<string, string>;
}

export interface CardUpdatePayload {
  id: string;
  templateId?: string;
  title?: string;
  subtitle?: string;
  flavorText?: string;
  backgroundImage?: string;
  backgroundImageUrl?: string;
  backgroundImageBase64?: string;
  backgroundImageMimeType?: string;
  foregroundImage?: string;
  foregroundImageUrl?: string;
  foregroundImageBase64?: string;
  foregroundImageMimeType?: string;
  customCss?: Record<string, string>;
}

interface CardCreateResponse {
  id: string;
  response: string;
}

interface ApiMessageResponse {
  response: string;
}

export interface CardPreviewRequest {
  templateId: string;
  title: string;
  subtitle: string;
  flavorText: string;
  backgroundImage?: string;
  backgroundImageUrl?: string;
  backgroundImageBase64?: string;
  backgroundImageMimeType?: string;
  foregroundImage?: string;
  foregroundImageUrl?: string;
  foregroundImageBase64?: string;
  foregroundImageMimeType?: string;
  customCss?: Record<string, string>;
}

export interface CardTemplate {
  id: string;
  name: string;
  description?: string;
}

export async function getCards() {
  const { data } = await apiClient.get<CardRecord[]>("/v1/cards");
  return data;
}

export async function getCard(id: string) {
  const { data } = await apiClient.get<CardRecord>(`/v1/cards/${id}`);
  return data;
}

export async function createCard(payload: CardCreatePayload) {
  const { data } = await apiClient.post<CardCreateResponse>(
    "/v1/cards",
    payload,
  );
  return data;
}

export async function updateCard(payload: CardUpdatePayload) {
  const { data } = await apiClient.put<ApiMessageResponse>(
    "/v1/cards",
    payload,
  );
  return data;
}

export async function deleteCard(id: string) {
  const { data } = await apiClient.delete<ApiMessageResponse>(
    `/v1/cards/${id}`,
  );
  return data;
}

export async function previewCard(payload: CardPreviewRequest) {
  const { data } = await apiClient.post<Blob>(
    "/v1/cards/preview?format=png&side=front",
    payload,
    {
      responseType: "blob",
    },
  );

  return data;
}

export async function getCardTemplates() {
  const { data } = await apiClient.get<CardTemplate[]>("/v1/card-templates");
  return data;
}
