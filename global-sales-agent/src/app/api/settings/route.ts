import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { getOrgSettings, updateOrgSettings, orgSettingsSchema } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMITS } from "@/lib/plans";

export const GET = withAuth("org:read", async (_req, { user }) => {
  const s = await getOrgSettings(user.orgId);
  return ok({ ...s, planLimits: PLAN_LIMITS[s.plan], providers: { anthropic: Boolean(process.env.ANTHROPIC_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY), demo: process.env.DEMO_MODE === "true" } });
});

export const PATCH = withAuth("org:settings", async (req, { user }) => {
  const b = await parseBody(req, z.object({ appName: z.string().min(1).max(60).optional(), name: z.string().min(1).max(120).optional(), settings: orgSettingsSchema.partial().optional() }));
  const before = await getOrgSettings(user.orgId);
  if (b.appName || b.name) await prisma.organization.update({ where: { id: user.orgId }, data: { appName: b.appName, name: b.name } });
  const settings = b.settings ? await updateOrgSettings(user.orgId, b.settings) : before.settings;
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "settings.updated", entityType: "organization", entityId: user.orgId, before: { appName: before.appName, settings: before.settings }, after: { appName: b.appName ?? before.appName, settings } });
  return ok(await getOrgSettings(user.orgId));
});
