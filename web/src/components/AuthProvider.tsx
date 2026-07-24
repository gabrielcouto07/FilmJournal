"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ initialUser = null, children }: { initialUser?: AuthUser | null; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  // Re-sincroniza quando o servidor re-renderiza o layout (login, logout, refresh).
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const login = async (username: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error ?? "Credenciais inválidas.");
    setUser(data.user);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.assign("/");
  };

  return <AuthContext.Provider value={{ user, loading: false, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
