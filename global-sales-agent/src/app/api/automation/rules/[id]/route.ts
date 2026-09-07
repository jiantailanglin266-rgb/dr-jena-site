import { withAuth, ok, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ruleInputSchema } from "@/lib/automation/engine";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = withAuth<Ctx>("automation:write", async (req, { user, params }) => {
  const { id } = await params;
  const before = await prisma.automationRule.findFirstOrThrow({ where: { id, organizationId: user.orgId } });
  const b = await parseBody(req, ruleInputSchema.partial());
  const rule = await prisma.automationRule.update({ where: { id }, data: { ...b, conditions: b.conditions as Prisma.InputJsonValue | undefined, actions: b.actions as Prisma.InputJsonValue | undefined } });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "rule.updated", entityType: "automation_rule", entityId: id, before: { enabled: before.enabled, name: before.name }, after: b });
  return ok(rule);
});
export const DELETE = withAuth<Ctx>("automation:write", async (_req, { user, params }) => {
  const { id } = await params;
  await prisma.automationRule.findFirstOrThrow({ where: { id, organizationId: user.orgId } });
  await prisma.automationRule.delete({ where: { id } });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "rule.deleted", entityType: "automation_rule", entityId: id });
  return ok({ id });
});
