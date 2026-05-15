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
const USER_CACHE_KEY = "mf-auth-user";

function saveUserCache(user: AuthUser) {
  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // storage full — ignore
  }
}

function loadUserCache(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function clearUserCache() {
  try {
    localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Immediately restore from localStorage so the UI renders with the
    // cached user even before the network call completes (or when offline).
    const cached = loadUserCache();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AuthUser | null) => {
        if (data?.id) {
          setUser(data);
          saveUserCache(data);
        } else if (!cached) {
          // Server said not authenticated and no cache — clear user
          setUser(null);
          clearUserCache();
        }
        // If server is unreachable (offline) and we have a cached user,
        // keep that cached user so the app remains usable
      })
      .catch(() => {
        // Network error (offline) — already showing cached user, do nothing
      })
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
    const data = await r.json() as AuthUser;
    setUser(data);
    saveUserCache(data);
  };

  const logout = async () => {
    try {
      await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors on logout
    }
    setUser(null);
    clearUserCache();
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
