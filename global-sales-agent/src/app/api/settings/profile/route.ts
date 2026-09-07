import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { getProfile } from "@/lib/agents/context";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const strArr = z.array(z.string()).default([]);
const profileSchema = z.object({
  companyName: z.string().min(1), tagline: z.string().nullable().optional(), services: z.string().default(""), strengths: strArr, weaknesses: strArr, capabilities: strArr, priceRange: z.string().nullable().optional(),
  minimumOrderPrice: z.number().min(0).default(0), currency: z.string().default("USD"), hourlyRate: z.number().min(0).nullable().optional(),
  achievements: z.array(z.object({ title: z.string(), description: z.string().optional(), metric: z.string().optional(), category: z.string().optional() })).default([]),
  portfolio: z.array(z.object({ title: z.string(), url: z.string().optional(), description: z.string().optional(), category: z.string().optional() })).default([]),
  caseStudies: z.array(z.object({ title: z.string(), problem: z.string().optional(), solution: z.string().optional(), result: z.string().optional() })).default([]),
  differentiators: strArr, languages: strArr, availableHours: z.string().nullable().optional(), typicalLeadTime: z.string().nullable().optional(), staffCount: z.number().int().nullable().optional(), techStack: strArr,
  pastProjects: z.array(z.object({ title: z.string(), description: z.string().optional(), year: z.string().optional() })).default([]),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]), forbiddenConditions: strArr, excludeKeywords: strArr, priorityKeywords: strArr,
});

export const GET = withAuth("org:read", async (_req, { user }) => ok(await getProfile(user.orgId)));
export const PUT = withAuth("org:settings", async (req, { user }) => {
  const b = await parseBody(req, profileSchema);
  const data = { ...b, achievements: b.achievements as Prisma.InputJsonValue, portfolio: b.portfolio as Prisma.InputJsonValue, caseStudies: b.caseStudies as Prisma.InputJsonValue, pastProjects: b.pastProjects as Prisma.InputJsonValue, faq: b.faq as Prisma.InputJsonValue };
  const p = await prisma.companyProfile.upsert({ where: { organizationId: user.orgId }, create: { organizationId: user.orgId, ...data }, update: data });
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "profile.updated", entityType: "company_profile", entityId: p.id });
  return ok(p);
});
