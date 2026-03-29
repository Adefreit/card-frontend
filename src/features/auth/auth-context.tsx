import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  apiClient,
  setTokenProvider,
  setUnauthorizedHandler,
} from "../../lib/http";
import { authStorage } from "../../lib/storage";

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
  const [token, setToken] = useState<string | null>(authStorage.getToken());
  const [userId, setUserId] = useState<string | null>(authStorage.getUserId());

  useEffect(() => {
    setTokenProvider(() => authStorage.getToken());
    setUnauthorizedHandler(() => {
      authStorage.clearToken();
      authStorage.clearUserId();
      setToken(null);
      setUserId(null);
    });
  }, []);

  const login = async (payload: LoginRequest) => {
    const { data } = await apiClient.post<LoginResponse>(
      "/v1/users/login",
      payload,
    );
    authStorage.setToken(data.token);
    authStorage.setUserId(data.userID);
    setToken(data.token);
    setUserId(data.userID);
  };

  const logout = () => {
    authStorage.clearToken();
    authStorage.clearUserId();
    setToken(null);
    setUserId(null);
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
