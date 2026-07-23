import type { DefaultSession } from "next-auth";

// Inclui nos tipos do NextAuth os dados do dono repassados pelo login com credenciais.
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
