import { withAuth, ok, parseBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ruleInputSchema } from "@/lib/automation/engine";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMITS } from "@/lib/plans";
import type { Prisma } from "@prisma/client";

export const GET = withAuth("automation:read", async (_req, { user }) => {
  const rules = await prisma.automationRule.findMany({ where: { organizationId: user.orgId }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], include: { _count: { select: { runs: true } } } });
  return ok(rules);
});

export const POST = withAuth("automation:write", async (req, { user }) => {
  const b = await parseBody(req, ruleInputSchema);
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });
  const count = await prisma.automationRule.count({ where: { organizationId: user.orgId } });
  if (count >= PLAN_LIMITS[org.plan].automationRules) throw new ApiError(`Plan ${org.plan} allows ${PLAN_LIMITS[org.plan].automationRules} rules`, 402);
  const rule = await prisma.automationRule.create({ data: { organizationId: user.orgId, ...b, conditions: b.conditions as Prisma.InputJsonValue, actions: b.actions as Prisma.InputJsonValue } });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "rule.created", entityType: "automation_rule", entityId: rule.id, after: b });
  return ok(rule);
});
