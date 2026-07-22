"use client";

import type { ReactNode } from "react";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";

interface AuthUser {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

/**
 * Thin adapter over NextAuth's `useSession` that preserves the pre-existing
 * `{ user, loading, login, logout }` API so consumer components are unchanged.
 */
export function useAuth(): AuthContextType {
  const { data: session, status } = useSession();

  const user: AuthUser | null = session?.user?.id
    ? {
        id: session.user.id,
        username: session.user.username,
        displayName: session.user.displayName ?? null,
        role: session.user.role,
      }
    : null;

  const login = async (username: string, password: string) => {
    const result = await signIn("credentials", { username, password, redirect: false });
    if (!result || result.error) {
      throw new Error("Credenciais inválidas.");
    }
  };

  const logout = async () => {
    // Auth.js returns an absolute redirect URL, which can point at a stale or
    // misconfigured deployment origin. Clear the session first, then navigate
    // relative to the origin that is actually open in the browser.
    await signOut({ redirect: false });
    window.location.assign("/");
  };

  return { user, loading: status === "loading", login, logout };
}
