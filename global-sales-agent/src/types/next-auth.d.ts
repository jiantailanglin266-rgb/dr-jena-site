import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      orgName: string;
      role: Role;
      locale: string;
    } & DefaultSession["user"];
  }
  interface User {
    orgId?: string;
    orgName?: string;
    role?: Role;
    locale?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    orgId?: string;
    orgName?: string;
    role?: string;
    locale?: string;
  }
}
