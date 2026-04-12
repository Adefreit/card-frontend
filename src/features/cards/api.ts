import { apiClient } from "../../lib/http";

export interface CardStats {
  green: number;
  yellow: number;
  red: number;
  purple: number;
  blue: number;
}

export interface CardContactAddress {
  street1?: string;
  street2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface CardContactInfo {
  firstName?: string;
  lastName?: string;
  organization?: string;
  jobTitle?: string;
  website?: string;
  birthday?: string;
  address?: CardContactAddress;
  homePhone?: string;
  cellPhone?: string;
  personalEmail?: string;
  workEmail?: string;
  socialAccounts?: Record<string, string>;
}

export interface CardCustomCss {
  bannerColor?: string;
  bannerForeground?: string;
}

export interface CardNamedUrl {
  name: string;
  url: string;
}

export interface CardPremiumUrl extends CardNamedUrl {}

export interface CardPremiumConfig {
  urlList?: CardPremiumUrl[];
}

export interface CardData {
  title: string;
  subtitle: string;
  flavorText: string;
  backgroundImage?: string;
  foregroundImage?: string;
  backgroundImageUrl?: string;
  foregroundImageUrl?: string;
  contactInfo?: CardContactInfo;
  customCss?: CardCustomCss;
  premium?: CardPremiumConfig;
  stats?: CardStats;
}

export interface CardRecord {
  id: string;
  user_id: string;
  template_id: string;
  create_time?: string;
  premium_expires_at?: string | null;
  last_render?: string | null;
  last_proof?: string | null;
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
  contactInfo?: CardContactInfo;
  customCss?: CardCustomCss;
  premium?: CardPremiumConfig;
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
  contactInfo?: CardContactInfo;
  customCss?: CardCustomCss;
  premium?: CardPremiumConfig;
}

interface CardCreateResponse {
  id: string;
  response: string;
}

interface ApiMessageResponse {
  response: string;
}

export interface CardPreviewRequest {
  id: string;
  templateId: string;
  title: string;
  subtitle: string;
  flavorText: string;
  side?: "front" | "back";
  backgroundImage?: string;
  backgroundImageUrl?: string;
  backgroundImageBase64?: string;
  backgroundImageMimeType?: string;
  foregroundImage?: string;
  foregroundImageUrl?: string;
  foregroundImageBase64?: string;
  foregroundImageMimeType?: string;
  contactInfo?: CardContactInfo;
  customCss?: CardCustomCss;
  premium?: CardPremiumConfig;
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
  const { side = "front", ...requestBody } = payload;
  const { data } = await apiClient.post<Blob>(
    `/v1/cards/render/preview?format=png&id=${payload.id}&side=${side}&showCutlines=true&showPreviewWatermark=true`,
    requestBody,
    {
      responseType: "blob",
    },
  );

  return data;
}

export async function renderCardProof(id: string) {
  const { data } = await apiClient.get<Blob>(`/v1/cards/render/proof/${id}`, {
    params: { format: "png", side: "front" },
    responseType: "blob",
  });

  return data;
}

export async function renderCardProofPrinterFriendly(id: string) {
  const { data } = await apiClient.get<Blob>(
    `/v1/cards/render/printerfriendly/${id}`,
    {
      params: { template: "Avery-95272" },
      responseType: "blob",
    },
  );

  return data;
}

export async function getCardTemplates() {
  const { data } = await apiClient.get<CardTemplate[]>("/v1/card-templates");
  return data;
}

export async function downloadPublicCardVcard(id: string) {
  const { data } = await apiClient.get<Blob>(`/v1/cards/${id}/vcard`, {
    responseType: "blob",
  });

  return data;
}
