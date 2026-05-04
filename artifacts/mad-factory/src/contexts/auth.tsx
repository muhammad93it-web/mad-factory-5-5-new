import React, { createContext, useContext, useEffect, useState } from "react";

export type AuthUser = {
  id: number;
  username: string;
  role: "admin" | "employee";
  permissions: string[];
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (slug: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.id) setUser(data as AuthUser);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "هەڵە ڕووی دا");
    }
    const data = await r.json();
    setUser(data as AuthUser);
  };

  const logout = async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  };

  const hasPermission = (slug: string) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.permissions.includes(slug);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
