import { z } from "zod";
import { withAuth, ok, parseBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMITS } from "@/lib/plans";

export const GET = withAuth("org:read", async (_req, { user }) => {
  const members = await prisma.membership.findMany({ where: { organizationId: user.orgId }, include: { user: { select: { id: true, name: true, email: true, locale: true, createdAt: true } } }, orderBy: { createdAt: "asc" } });
  return ok(members);
});
export const POST = withAuth("org:members", async (req, { user }) => {
  const b = await parseBody(req, z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(8), role: z.enum(["ADMIN", "MANAGER", "SALES", "VIEWER"]) }));
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });
  const count = await prisma.membership.count({ where: { organizationId: user.orgId } });
  if (count >= PLAN_LIMITS[org.plan].maxUsers) throw new ApiError(`Plan ${org.plan} allows ${PLAN_LIMITS[org.plan].maxUsers} users`, 402);
  const email = b.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  const u = existing ?? (await prisma.user.create({ data: { email, name: b.name, passwordHash: await hashPassword(b.password) } }));
  const m = await prisma.membership.upsert({ where: { userId_organizationId: { userId: u.id, organizationId: user.orgId } }, create: { userId: u.id, organizationId: user.orgId, role: b.role }, update: { role: b.role } });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "member.added", entityType: "membership", entityId: m.id, after: { email, role: b.role } });
  return ok(m);
});
