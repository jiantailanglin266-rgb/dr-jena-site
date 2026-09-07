import { prisma } from "../db";
import { createAIContext, type AIContext } from "../ai/provider";
import type { OrgSettings } from "../settings";
import type { CompanyProfile } from "@prisma/client";

export interface AgentContext {
  orgId: string;
  settings: OrgSettings;
  ai: AIContext;
  profile: CompanyProfile;
  actorUserId?: string | null;
}

export const DEFAULT_PROFILE: Omit<CompanyProfile, "id" | "organizationId" | "createdAt" | "updatedAt"> = {
  companyName: "Your Company",
  tagline: null,
  services: "",
  strengths: [],
  weaknesses: [],
  capabilities: [],
  priceRange: null,
  minimumOrderPrice: 0 as unknown as CompanyProfile["minimumOrderPrice"],
  currency: "USD",
  hourlyRate: null,
  achievements: [],
  portfolio: [],
  caseStudies: [],
  differentiators: [],
  languages: [],
  availableHours: null,
  typicalLeadTime: null,
  staffCount: null,
  techStack: [],
  pastProjects: [],
  faq: [],
  forbiddenConditions: [],
  excludeKeywords: [],
  priorityKeywords: [],
};

export async function getProfile(orgId: string): Promise<CompanyProfile> {
  const p = await prisma.companyProfile.findUnique({ where: { organizationId: orgId } });
  if (p) return p;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  return prisma.companyProfile.create({ data: { organizationId: orgId, companyName: org.name } });
}

export async function buildAgentContext(orgId: string, actorUserId?: string | null): Promise<AgentContext> {
  const [ai, profile] = await Promise.all([createAIContext(orgId), getProfile(orgId)]);
  return { orgId, settings: ai.settings, ai, profile, actorUserId };
}

/** Compact profile view handed to prompts / mock */
export function profileForPrompt(p: CompanyProfile) {
  return {
    companyName: p.companyName,
    tagline: p.tagline,
    services: p.services,
    strengths: p.strengths,
    weaknesses: p.weaknesses,
    capabilities: p.capabilities,
    priceRange: p.priceRange,
    minimumOrderPrice: Number(p.minimumOrderPrice),
    currency: p.currency,
    hourlyRate: p.hourlyRate ? Number(p.hourlyRate) : null,
    achievements: p.achievements as { title: string; description?: string; metric?: string; category?: string }[],
    portfolio: p.portfolio as { title: string; url?: string; description?: string; category?: string }[],
    caseStudies: p.caseStudies as { title: string; problem?: string; solution?: string; result?: string }[],
    differentiators: p.differentiators,
    languages: p.languages,
    availableHours: p.availableHours,
    typicalLeadTime: p.typicalLeadTime,
    staffCount: p.staffCount,
    techStack: p.techStack,
    faq: p.faq as { q: string; a: string }[],
    forbiddenConditions: p.forbiddenConditions,
    excludeKeywords: p.excludeKeywords,
    priorityKeywords: p.priorityKeywords,
  };
}

export type PromptProfile = ReturnType<typeof profileForPrompt>;
