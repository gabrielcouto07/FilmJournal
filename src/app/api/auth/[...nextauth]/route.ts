import { handlers } from "@/auth";

// NextAuth v5 route handlers: powers /api/auth/session, /api/auth/callback/credentials,
// /api/auth/signin, /api/auth/signout, etc.
export const { GET, POST } = handlers;
