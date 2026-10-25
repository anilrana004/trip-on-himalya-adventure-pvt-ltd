"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { components } from "@/openapi/generated";
import { api, refreshAccess, tokenStore } from "@/lib/api";
import { homePathForRole, loginPathForRole } from "@/lib/rbac";

type User = components["schemas"]["UserInfo"];

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tokenStore.forgetLegacy();
    refreshAccess()
      .then((token) => (token ? api.me() : null))
      .then((me) => setUser(me))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      if (!res.accessToken) throw new Error("Login response missing access token");
      tokenStore.setAccess(res.accessToken);
      setUser(res.user ?? null);
      router.replace(homePathForRole(res.user?.role));
    },
    [router],
  );

  const logout = useCallback(async () => {
    const role = user?.role;
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      tokenStore.clear();
      setUser(null);
      router.replace(loginPathForRole(role));
    }
  }, [router, user?.role]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
