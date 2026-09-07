import { z } from "zod";
import { prisma } from "./db";
import { PLAN_LIMITS } from "./plans";
import type { Plan } from "@prisma/client";

export const PROPOSAL_TONES = ["PROFESSIONAL", "FRIENDLY", "CONSULTATIVE", "EXECUTIVE", "TECHNICAL", "PREMIUM"] as const;
export const PROPOSAL_LENGTHS = ["SHORT", "STANDARD", "DETAILED"] as const;
export const AUTOMATION_LEVELS = ["MANUAL", "ASSISTED", "SEMI_AUTO", "FULL_AUTO"] as const;
export const SUPPORTED_LANGUAGES = ["ja", "en", "zh", "ko", "es", "fr", "de", "pt", "it"] as const;

export const LANGUAGE_NAMES: Record<string, string> = {
  ja: "日本語", en: "English", zh: "中文", ko: "한국어", es: "Español", fr: "Français", de: "Deutsch", pt: "Português", it: "Italiano",
  nl: "Nederlands", ru: "Русский", ar: "العربية", hi: "हिन्दी", th: "ไทย", vi: "Tiếng Việt", id: "Bahasa Indonesia",
};

export const pricingSchema = z.object({
  minimumPrice: z.number().min(0).default(1000),
  targetPrice: z.number().min(0).default(3000),
  idealPrice: z.number().min(0).default(5000),
  maximumDiscountPct: z.number().min(0).max(90).default(15),
  currency: z.string().default("USD"),
  hourlyRate: z.number().min(0).default(80),
});

export const orgSettingsSchema = z.object({
  aiProvider: z.enum(["auto", "anthropic", "openai", "mock"]).default("auto"),
  aiModel: z.string().default(""),
  temperature: z.number().min(0).max(1).default(0.4),
  defaultLanguage: z.string().default("ja"),
  salesTone: z.enum(PROPOSAL_TONES).default("CONSULTATIVE"),
  defaultProposalLength: z.enum(PROPOSAL_LENGTHS).default("STANDARD"),
  autoSendEnabled: z.boolean().default(false),
  automationLevel: z.enum(AUTOMATION_LEVELS).default("ASSISTED"),
  requireHumanApprovalForWon: z.boolean().default(true),
  requireHumanApprovalForPrice: z.boolean().default(true),
  minJobBudgetUsd: z.number().min(0).default(500),
  minOpportunityScore: z.number().min(0).max(100).default(40),
  targetCategories: z.array(z.string()).default([]),
  targetCountries: z.array(z.string()).default([]),
  targetLanguages: z.array(z.string()).default([]),
  excludeKeywords: z.array(z.string()).default([]),
  businessHours: z
    .object({
      start: z.string().default("09:00"),
      end: z.string().default("18:00"),
      timezone: z.string().default("Asia/Tokyo"),
      days: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
      restrictSending: z.boolean().default(false),
    })
    .default({ start: "09:00", end: "18:00", timezone: "Asia/Tokyo", days: [1, 2, 3, 4, 5], restrictSending: false }),
  aiDailyCostLimitUsd: z.number().min(0).default(10),
  aiMonthlyCostLimitUsd: z.number().min(0).default(200),
  pricing: pricingSchema.default({ minimumPrice: 1000, targetPrice: 3000, idealPrice: 5000, maximumDiscountPct: 15, currency: "USD", hourlyRate: 80 }),
  abTesting: z.object({ enabled: z.boolean().default(false), variantBSharePct: z.number().min(0).max(100).default(30) }).default({ enabled: false, variantBSharePct: 30 }),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;
export type PricingConfig = z.infer<typeof pricingSchema>;

export const DEFAULT_SETTINGS: OrgSettings = orgSettingsSchema.parse({});

export function parseSettings(raw: unknown): OrgSettings {
  const r = orgSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : DEFAULT_SETTINGS;
}

export async function getOrgSettings(orgId: string): Promise<{ settings: OrgSettings; plan: Plan; appName: string; name: string }> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { settings: true, plan: true, appName: true, name: true } });
  const settings = parseSettings(org.settings);
  const limits = PLAN_LIMITS[org.plan];
  // Plan caps the AI daily cost limit
  settings.aiDailyCostLimitUsd = Math.min(settings.aiDailyCostLimitUsd, limits.aiDailyCostLimitUsd);
  if (!limits.fullAutomation && settings.automationLevel === "FULL_AUTO") settings.automationLevel = "SEMI_AUTO";
  return { settings, plan: org.plan, appName: org.appName, name: org.name };
}

export async function updateOrgSettings(orgId: string, patch: Partial<OrgSettings>): Promise<OrgSettings> {
  const current = await getOrgSettings(orgId);
  const merged = orgSettingsSchema.parse({ ...current.settings, ...patch });
  await prisma.organization.update({ where: { id: orgId }, data: { settings: merged } });
  return merged;
}
