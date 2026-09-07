import { z } from "zod";
import { withAuth, ok, parseBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = withAuth<Ctx>("org:members", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ role: z.enum(["ADMIN", "MANAGER", "SALES", "VIEWER"]) }));
  const m = await prisma.membership.findFirstOrThrow({ where: { id, organizationId: user.orgId } });
  if (m.userId === user.id && b.role !== "ADMIN") throw new ApiError("You cannot demote yourself", 409);
  const updated = await prisma.membership.update({ where: { id }, data: { role: b.role } });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "member.role", entityType: "membership", entityId: id, before: { role: m.role }, after: { role: b.role } });
  return ok(updated);
});
export const DELETE = withAuth<Ctx>("org:members", async (_req, { user, params }) => {
  const { id } = await params;
  const m = await prisma.membership.findFirstOrThrow({ where: { id, organizationId: user.orgId } });
  if (m.userId === user.id) throw new ApiError("You cannot remove yourself", 409);
  await prisma.membership.delete({ where: { id } });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "member.removed", entityType: "membership", entityId: id });
  return ok({ id });
});
