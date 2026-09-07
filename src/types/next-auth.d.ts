import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "member";
      mustResetPassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "admin" | "member";
    mustResetPassword?: boolean;
  }
}
