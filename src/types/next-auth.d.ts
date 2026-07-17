import type { DefaultSession } from "next-auth";

// Augment NextAuth's User/Session/JWT with the owner fields we carry through
// the Credentials provider so `session.user.role` etc. are strongly typed.
declare module "next-auth" {
  interface User {
    id?: string;
    username: string;
    displayName: string | null;
    role: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string | null;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    displayName: string | null;
    role: string;
  }
}
