import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth config: no database or Node crypto imports here so it can
// be consumed by `middleware.ts` (Edge runtime). The Credentials provider,
// which needs Prisma + node:crypto, is added in `src/auth.ts` for the Node runtime.
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // Gate the admin surface. Returning false triggers a redirect to `pages.signIn`.
    authorized({ auth, request }) {
      const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
      if (!isAdminRoute) return true;
      return auth?.user?.role === "OWNER";
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = user.username;
        token.displayName = user.displayName ?? null;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.displayName = (token.displayName as string | null) ?? null;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
