import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import { authConfig } from "./auth.config";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { memberships: { include: { organization: true }, orderBy: { createdAt: "asc" }, take: 1 } },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        const membership = user.memberships[0];
        if (!membership) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: membership.organizationId,
          orgName: membership.organization.name,
          role: membership.role,
          locale: user.locale,
        };
      },
    }),
  ],
});

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: Role;
  locale: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    orgId: session.user.orgId,
    orgName: session.user.orgName,
    role: session.user.role,
    locale: session.user.locale,
  };
}

/** Server component helper: redirects to /login when unauthenticated */
export async function requireSession(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
