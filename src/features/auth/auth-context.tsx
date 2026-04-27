import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  apiClient,
  setTokenProvider,
  setUnauthorizedHandler,
} from "../../lib/http";
import { authStorage } from "../../lib/storage";
import { getCurrentUserProfile } from "./api";

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

    return JSON.parse(json) as {
      exp?: number;
      uid?: string;
      userID?: string;
      permissions?: string[];
    };
  } catch {
    return null;
  }
}

function getTokenUserId(token: string) {
  const payload = decodeJwtPayload(token);
  return payload?.uid ?? payload?.userID ?? null;
}

function getTokenPermissions(token: string) {
  const payload = decodeJwtPayload(token);
  const permissions = payload?.permissions;

  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions
    .filter(
      (permission): permission is string => typeof permission === "string",
    )
    .map((permission) => permission.toUpperCase());
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
  const storedAccountSubscriptionUntil =
    authStorage.getAccountSubscriptionUntil();

  if (!storedToken) {
    return {
      token: null,
      userId: storedUserId,
      accountSubscriptionUntil: storedAccountSubscriptionUntil,
    };
  }

  if (isTokenExpired(storedToken)) {
    authStorage.setAuthNotice("Your session expired. Please sign in again.");
    authStorage.clearToken();
    authStorage.clearUserId();
    authStorage.clearAccountSubscriptionUntil();
    return {
      token: null,
      userId: null,
      accountSubscriptionUntil: null,
    };
  }

  const tokenUserId = getTokenUserId(storedToken);

  return {
    token: storedToken,
    userId: storedUserId ?? tokenUserId,
    accountSubscriptionUntil: storedAccountSubscriptionUntil,
  };
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  response: string;
  userID: string;
  token: string;
  account_subscription_until?: string | null;
}

interface AuthContextValue {
  token: string | null;
  userId: string | null;
  accountSubscriptionUntil: string | null;
  userPermissions: string[];
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshAccountProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedSession = getStoredSession();
  const [token, setToken] = useState<string | null>(storedSession.token);
  const [userId, setUserId] = useState<string | null>(storedSession.userId);
  const [accountSubscriptionUntil, setAccountSubscriptionUntil] = useState<
    string | null
  >(storedSession.accountSubscriptionUntil ?? null);
  const [userPermissions, setUserPermissions] = useState<string[]>(
    storedSession.token ? getTokenPermissions(storedSession.token) : [],
  );

  const clearSession = (reason?: "expired") => {
    if (reason === "expired") {
      authStorage.setAuthNotice("Your session expired. Please sign in again.");
    }

    authStorage.clearToken();
    authStorage.clearUserId();
    authStorage.clearAccountSubscriptionUntil();
    setToken(null);
    setUserId(null);
    setAccountSubscriptionUntil(null);
    setUserPermissions([]);
  };

  const refreshAccountProfile = async (
    tokenOverride?: string | null,
    userIdOverride?: string | null,
  ) => {
    const activeToken = tokenOverride ?? token;
    const activeUserId = userIdOverride ?? userId;
    const jwtPermissions = activeToken ? getTokenPermissions(activeToken) : [];

    if (!activeToken || !activeUserId) {
      setAccountSubscriptionUntil(null);
      setUserPermissions(jwtPermissions);
      authStorage.clearAccountSubscriptionUntil();
      return;
    }

    try {
      const profile = await getCurrentUserProfile(activeUserId);
      const nextSubscriptionUntil = profile.account_subscription_until ?? null;
      const nextPermissions = Array.isArray(profile.permissions)
        ? profile.permissions
            .filter(
              (permission): permission is string =>
                typeof permission === "string",
            )
            .map((permission) => permission.toUpperCase())
        : jwtPermissions;

      authStorage.setAccountSubscriptionUntil(nextSubscriptionUntil);
      setAccountSubscriptionUntil(nextSubscriptionUntil);
      setUserPermissions(nextPermissions);
    } catch {
      setUserPermissions(jwtPermissions);
    }
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

  useEffect(() => {
    if (!token || !userId) {
      return;
    }

    void refreshAccountProfile();
  }, [token, userId]);

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
    authStorage.setAccountSubscriptionUntil(
      data.account_subscription_until ?? null,
    );
    setToken(data.token);
    setUserId(data.userID);
    setAccountSubscriptionUntil(data.account_subscription_until ?? null);
    setUserPermissions(getTokenPermissions(data.token));
    await refreshAccountProfile(data.token, data.userID);
  };

  const logout = () => {
    clearSession();
  };

  const value = useMemo(
    () => ({
      token,
      userId,
      accountSubscriptionUntil,
      userPermissions,
      isAuthenticated: Boolean(token),
      login,
      logout,
      refreshAccountProfile,
    }),
    [token, userId, accountSubscriptionUntil, userPermissions],
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
