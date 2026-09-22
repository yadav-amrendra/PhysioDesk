"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiPost,
  apiRequest,
  type TokenResponse,
  type User,
} from "@/lib/api";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth-storage";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(accessToken: string): Promise<User> {
  return apiRequest<User>("/api/v1/auth/me", { token: accessToken });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      setUser(null);
      setStatus("unauthenticated");
      return false;
    }

    try {
      const tokens = await apiPost<TokenResponse>("/api/v1/auth/refresh", {
        refresh_token: refreshToken,
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const me = await fetchMe(tokens.access_token);
      setUser(me);
      setStatus("authenticated");
      return true;
    } catch {
      clearTokens();
      setUser(null);
      setStatus("unauthenticated");
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      // Yield so token absence doesn't setState synchronously inside the effect.
      await Promise.resolve();
      if (!active) return;

      const accessToken = getAccessToken();
      if (!accessToken) {
        setStatus("unauthenticated");
        return;
      }

      try {
        const me = await fetchMe(accessToken);
        if (!active) return;
        setUser(me);
        setStatus("authenticated");
      } catch {
        if (!active) return;
        const refreshed = await refreshSession();
        if (!active || refreshed) return;
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await apiPost<TokenResponse>("/api/v1/auth/login", {
      email,
      password,
    });
    setTokens(tokens.access_token, tokens.refresh_token);
    const me = await fetchMe(tokens.access_token);
    setUser(me);
    setStatus("authenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout, refreshSession }),
    [status, user, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
