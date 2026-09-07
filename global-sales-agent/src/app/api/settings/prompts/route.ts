import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { AGENT_NAMES, DEFAULT_PROMPTS } from "@/lib/agents/prompts";
import { logAudit } from "@/lib/audit";

export const GET = withAuth("org:read", async (_req, { user }) => {
  const custom = await prisma.promptTemplate.findMany({ where: { organizationId: user.orgId } });
  return ok(AGENT_NAMES.map((agent) => ({ agent, defaults: DEFAULT_PROMPTS[agent], custom: custom.find((c) => c.agent === agent) ?? null })));
});
export const PUT = withAuth("org:settings", async (req, { user }) => {
  const b = await parseBody(req, z.object({ agent: z.enum(AGENT_NAMES), system: z.string().min(1), user: z.string().min(1), enabled: z.boolean().default(true), reset: z.boolean().optional() }));
  if (b.reset) {
    await prisma.promptTemplate.deleteMany({ where: { organizationId: user.orgId, agent: b.agent } });
    return ok({ agent: b.agent, reset: true });
  }
  const t = await prisma.promptTemplate.upsert({ where: { organizationId_agent: { organizationId: user.orgId, agent: b.agent } }, create: { organizationId: user.orgId, agent: b.agent, name: `${b.agent} (custom)`, system: b.system, user: b.user, enabled: b.enabled }, update: { system: b.system, user: b.user, enabled: b.enabled } });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "prompt.updated", entityType: "prompt_template", entityId: t.id, after: { agent: b.agent, enabled: b.enabled } });
  return ok(t);
});
