import { prisma } from "../db";

export interface LimitViolation {
  code: "DAILY_LIMIT" | "HOURLY_LIMIT" | "CLIENT_CONTACT_LIMIT" | "PLAN_LIMIT";
  message: string;
}

export async function getPlatformLimit(orgId: string, platformKey: string) {
  const l = await prisma.platformLimit.findUnique({ where: { organizationId_platformKey: { organizationId: orgId, platformKey } } });
  return { dailyLimit: l?.dailyLimit ?? 20, hourlyLimit: l?.hourlyLimit ?? 5, maxContactsPerClientPerWeek: l?.maxContactsPerClientPerWeek ?? 2 };
}

/** Daily / Hourly / Platform / Client-contact limits. Counts SENT proposals + OUTBOUND messages. */
export async function checkSendLimits(orgId: string, platformKey: string, clientId: string | null): Promise<{ ok: boolean; violations: LimitViolation[]; usage: { day: number; hour: number; dailyLimit: number; hourlyLimit: number } }> {
  const limit = await getPlatformLimit(orgId, platformKey);
  const now = Date.now();
  const dayStart = new Date(now - 24 * 3600 * 1000);
  const hourStart = new Date(now - 3600 * 1000);
  const [day, hour] = await Promise.all([
    prisma.proposal.count({ where: { organizationId: orgId, platformKey, sentAt: { gte: dayStart } } }),
    prisma.proposal.count({ where: { organizationId: orgId, platformKey, sentAt: { gte: hourStart } } }),
  ]);
  const violations: LimitViolation[] = [];
  if (day >= limit.dailyLimit) violations.push({ code: "DAILY_LIMIT", message: `Daily limit reached for ${platformKey} (${day}/${limit.dailyLimit})` });
  if (hour >= limit.hourlyLimit) violations.push({ code: "HOURLY_LIMIT", message: `Hourly limit reached for ${platformKey} (${hour}/${limit.hourlyLimit})` });
  if (clientId) {
    const weekStart = new Date(now - 7 * 24 * 3600 * 1000);
    const contacts = await prisma.proposal.count({ where: { organizationId: orgId, sentAt: { gte: weekStart }, opportunity: { clientId } } });
    if (contacts >= limit.maxContactsPerClientPerWeek) violations.push({ code: "CLIENT_CONTACT_LIMIT", message: `Client contacted ${contacts} time(s) this week (limit ${limit.maxContactsPerClientPerWeek})` });
  }
  return { ok: violations.length === 0, violations, usage: { day, hour, dailyLimit: limit.dailyLimit, hourlyLimit: limit.hourlyLimit } };
}
