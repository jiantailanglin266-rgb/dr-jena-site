import type { NextAuthConfig } from "next-auth";

/** Edge-safe config (no Prisma / bcrypt). Shared by proxy.ts and auth.ts */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; orgId: string; role: string; locale: string; orgName: string };
        token.sub = u.id;
        token.orgId = u.orgId;
        token.role = u.role;
        token.locale = u.locale;
        token.orgName = u.orgName;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.orgId = token.orgId as string;
      session.user.role = token.role as "ADMIN" | "MANAGER" | "SALES" | "VIEWER";
      session.user.locale = (token.locale as string) ?? "ja";
      session.user.orgName = (token.orgName as string) ?? "";
      return session;
    },
  },
} satisfies NextAuthConfig;
