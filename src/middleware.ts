import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-runtime middleware built from the DB-free auth config. It only reads the
// signed JWT, so it never touches Prisma or node:crypto. The `authorized`
// callback in `auth.config.ts` enforces the /admin gate.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
