import axios from "axios";
import { appConfig } from "./config";

let tokenProvider: () => string | null = () => null;
let unauthorizedHandler: (() => void) | null = null;

export function setTokenProvider(provider: () => string | null) {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export const apiClient = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 15000,
});

apiClient.interceptors.request.use((requestConfig) => {
  const token = tokenProvider();

  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }

  if (appConfig.frontendApiKey && requestConfig.url?.includes("/v1/users")) {
    requestConfig.headers["X-API-Key"] = appConfig.frontendApiKey;
  }

  return requestConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);
