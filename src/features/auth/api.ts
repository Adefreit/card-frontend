import { apiClient } from "../../lib/http";

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface RequestPasswordResetPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  password: string;
  activationCode: string;
}

interface ApiMessageResponse {
  response: string;
}

export async function registerUser(payload: RegisterPayload) {
  const { data } = await apiClient.post<ApiMessageResponse>(
    "/v1/users/register",
    payload,
  );
  return data;
}

export async function activateUser(email: string, code: string) {
  const { data } = await apiClient.get<ApiMessageResponse>(
    `/v1/users/activate/${encodeURIComponent(email)}/${encodeURIComponent(code)}`,
  );
  return data;
}

export async function requestPasswordReset(
  payload: RequestPasswordResetPayload,
) {
  const { data } = await apiClient.post<ApiMessageResponse>(
    "/v1/users/requestPasswordReset",
    payload,
  );
  return data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await apiClient.post<ApiMessageResponse>(
    "/v1/users/resetPassword",
    payload,
  );
  return data;
}
