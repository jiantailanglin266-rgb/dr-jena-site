import { withAuth, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = withAuth("automation:read", async (_req, { user }) => {
  const runs = await prisma.automationRun.findMany({ where: { organizationId: user.orgId }, include: { rule: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return ok(runs);
});
