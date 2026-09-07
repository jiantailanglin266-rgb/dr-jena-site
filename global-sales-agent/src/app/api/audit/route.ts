import { z } from "zod";
import { withAuth, ok, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = withAuth("audit:read", async (req, { user }) => {
  const q = parseQuery(req, z.object({ entityType: z.string().optional(), entityId: z.string().optional(), actorType: z.enum(["USER", "AI", "SYSTEM"]).optional(), page: z.coerce.number().optional(), pageSize: z.coerce.number().optional() }));
  const page = q.page ?? 1;
  const pageSize = Math.min(200, q.pageSize ?? 50);
  const where = { organizationId: user.orgId, ...(q.entityType ? { entityType: q.entityType } : {}), ...(q.entityId ? { entityId: q.entityId } : {}), ...(q.actorType ? { actorType: q.actorType } : {}) };
  const [items, total] = await Promise.all([prisma.auditLog.findMany({ where, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.auditLog.count({ where })]);
  return ok({ items, total, page, pageSize });
});
