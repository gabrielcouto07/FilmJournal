import type { NextAuthConfig } from "next-auth";

// Esta parte roda no Edge e não pode depender do banco nem do crypto do Node.
// O login com credenciais fica em `src/auth.ts`.
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // Só o dono pode entrar na área administrativa.
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
