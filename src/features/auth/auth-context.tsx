import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  apiClient,
  setTokenProvider,
  setUnauthorizedHandler,
} from "../../lib/http";
import { authStorage } from "../../lib/storage";

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);

    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

function getTokenExpirationTime(token: string) {
  const payload = decodeJwtPayload(token);

  if (typeof payload?.exp !== "number") {
    return null;
  }

  return payload.exp * 1000;
}

function isTokenExpired(token: string) {
  const expirationTime = getTokenExpirationTime(token);

  if (expirationTime === null) {
    return false;
  }

  return expirationTime <= Date.now();
}

function getStoredSession() {
  const storedToken = authStorage.getToken();
  const storedUserId = authStorage.getUserId();

  if (!storedToken) {
    return { token: null, userId: storedUserId };
  }

  if (isTokenExpired(storedToken)) {
    authStorage.setAuthNotice("Your session expired. Please sign in again.");
    authStorage.clearToken();
    authStorage.clearUserId();
    return { token: null, userId: null };
  }

  return { token: storedToken, userId: storedUserId };
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  response: string;
  userID: string;
  token: string;
}

interface AuthContextValue {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedSession = getStoredSession();
  const [token, setToken] = useState<string | null>(storedSession.token);
  const [userId, setUserId] = useState<string | null>(storedSession.userId);

  const clearSession = (reason?: "expired") => {
    if (reason === "expired") {
      authStorage.setAuthNotice("Your session expired. Please sign in again.");
    }

    authStorage.clearToken();
    authStorage.clearUserId();
    setToken(null);
    setUserId(null);
  };

  useEffect(() => {
    setTokenProvider(() => {
      if (!token || isTokenExpired(token)) {
        return null;
      }

      return token;
    });
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession("expired"));
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const expirationTime = getTokenExpirationTime(token);

    if (expirationTime === null) {
      return;
    }

    const remainingTime = expirationTime - Date.now();

    if (remainingTime <= 0) {
      clearSession("expired");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearSession("expired");
    }, remainingTime);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [token]);

  const login = async (payload: LoginRequest) => {
    const { data } = await apiClient.post<LoginResponse>(
      "/v1/users/login",
      payload,
    );

    if (isTokenExpired(data.token)) {
      clearSession("expired");
      throw new Error("Your session expired. Please sign in again.");
    }

    authStorage.setToken(data.token);
    authStorage.setUserId(data.userID);
    setToken(data.token);
    setUserId(data.userID);
  };

  const logout = () => {
    clearSession();
  };

  const value = useMemo(
    () => ({
      token,
      userId,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
