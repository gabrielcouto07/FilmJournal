import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Owner credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = typeof credentials?.username === "string" ? credentials.username : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !verifyPassword(password, user.passwordHash)) return null;

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          email: user.email,
          name: user.displayName ?? user.username,
        };
      },
    }),
  ],
});
