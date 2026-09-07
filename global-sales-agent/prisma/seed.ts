import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateDemoJobs } from "../src/lib/demo/jobs";
import { encryptJson } from "../src/lib/crypto";
import { listConnectors } from "../src/lib/connectors/registry";
import { toUsd } from "../src/lib/currency";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { DEMO_PROFILE } from "../src/lib/demo/profile";

const prisma = new PrismaClient();

export const DEFAULT_RULES = [
  { name: "High-fit auto proposal", description: "Fit > 85, budget > 1000 USD, rating > 4.5, risk < 20 → create proposal", trigger: "JOB_ANALYZED" as const, priority: 200, conditions: [{ field: "analysis.fitScore", op: "gt", value: 85 }, { field: "job.budgetUsd", op: "gt", value: 1000 }, { field: "job.clientRating", op: "gt", value: 4.5 }, { field: "analysis.riskScore", op: "lt", value: 20 }], actions: [{ type: "CREATE_PROPOSAL", params: { length: "STANDARD", tone: "CONSULTATIVE" } }] },
  { name: "Low opportunity exclusion", description: "Opportunity score < 40 → exclude", trigger: "JOB_ANALYZED" as const, priority: 150, conditions: [{ field: "analysis.opportunityScore", op: "lt", value: 40 }], actions: [{ type: "EXCLUDE_JOB", params: { reason: "opportunity_score_below_40" } }] },
  { name: "Price negotiation reply", description: "Client negotiates price → Negotiation Agent", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "eq", value: "PRICE_NEGOTIATION" }], actions: [{ type: "GENERATE_NEGOTIATION_REPLY", params: {} }] },
  { name: "Questions → AI reply", description: "Questions / technical / portfolio → generate reply", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "in", value: ["QUESTION", "TECHNICAL_QUESTION", "REQUEST_PORTFOLIO", "INTERESTED", "OBJECTION", "SCHEDULE_NEGOTIATION", "UNKNOWN"] }], actions: [{ type: "GENERATE_REPLY", params: {} }] },
  { name: "Meeting requested", description: "Meeting request → status + task + reply", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "eq", value: "REQUEST_MEETING" }], actions: [{ type: "SET_LEAD_STATUS", params: { status: "MEETING_REQUESTED" } }, { type: "CREATE_TASK", params: { title: "Schedule meeting with client" } }, { type: "GENERATE_REPLY", params: {} }] },
  { name: "Acceptance → deal summary", description: "Client accepts → Closing Agent + human approval", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "eq", value: "ACCEPTANCE" }], actions: [{ type: "CREATE_DEAL_SUMMARY", params: {} }, { type: "REQUEST_HUMAN_APPROVAL", params: { title: "Approve deal (WON)", reason: "Client accepted — confirm terms before marking WON" } }] },
];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@demo.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Demo1234!";

  // Platforms catalog
  for (const c of listConnectors()) {
    await prisma.platform.upsert({
      where: { key: c.key },
      create: { key: c.key, displayName: c.displayName, website: c.website ?? null, officialApi: c.compliance.officialApi, automatedSendingPolicy: c.compliance.automatedSendingPolicy, defaultSendMode: c.compliance.defaultSendMode, termsUrl: c.compliance.termsUrl ?? null, complianceNotes: c.compliance.notes, supportedLanguages: c.supportedLanguages },
      update: { displayName: c.displayName, complianceNotes: c.compliance.notes, automatedSendingPolicy: c.compliance.automatedSendingPolicy, defaultSendMode: c.compliance.defaultSendMode },
    });
  }

  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    create: { name: "Dr.Jena Demo Org", slug: "demo", appName: "GLOBAL SALES AGENT", plan: "BUSINESS", settings: { ...DEFAULT_SETTINGS, defaultLanguage: "ja", automationLevel: "SEMI_AUTO", autoSendEnabled: true, minJobBudgetUsd: 500, minOpportunityScore: 40, aiDailyCostLimitUsd: 25, pricing: { minimumPrice: 1000, targetPrice: 4000, idealPrice: 8000, maximumDiscountPct: 15, currency: "USD", hourlyRate: 85 }, abTesting: { enabled: true, variantBSharePct: 30 } } },
    update: {},
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const users = [
    { email: adminEmail, name: "Demo Admin", role: "ADMIN" as const },
    { email: "manager@demo.local", name: "Demo Manager", role: "MANAGER" as const },
    { email: "sales@demo.local", name: "Demo Sales", role: "SALES" as const },
    { email: "viewer@demo.local", name: "Demo Viewer", role: "VIEWER" as const },
  ];
  for (const u of users) {
    const user = await prisma.user.upsert({ where: { email: u.email }, create: { email: u.email, name: u.name, passwordHash, locale: "ja" }, update: { passwordHash } });
    await prisma.membership.upsert({ where: { userId_organizationId: { userId: user.id, organizationId: org.id } }, create: { userId: user.id, organizationId: org.id, role: u.role }, update: { role: u.role } });
  }

  await prisma.companyProfile.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, ...DEMO_PROFILE }, update: { ...DEMO_PROFILE } });
  await prisma.languageSetting.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, defaultLanguage: "ja", uiLocale: "ja" }, update: {} });

  // Platform accounts: demo marketplace (AUTO), plus manual-only accounts for JP platforms and Upwork/Freelancer placeholders
  const demoPlatform = await prisma.platform.findUniqueOrThrow({ where: { key: "demo-marketplace" } });
  await prisma.platformAccount.upsert({
    where: { organizationId_platformKey: { organizationId: org.id, platformKey: "demo-marketplace" } },
    create: { organizationId: org.id, platformId: demoPlatform.id, platformKey: "demo-marketplace", label: "Demo Marketplace", enabled: true, sendMode: "AUTO", credentialsEncrypted: encryptJson({ apiKey: "demo-key" }) },
    update: { enabled: true, sendMode: "AUTO" },
  });
  for (const key of ["coconala", "crowdworks", "lancers", "upwork", "freelancer"]) {
    const p = await prisma.platform.findUniqueOrThrow({ where: { key } });
    await prisma.platformAccount.upsert({
      where: { organizationId_platformKey: { organizationId: org.id, platformKey: key } },
      create: { organizationId: org.id, platformId: p.id, platformKey: key, label: p.displayName, enabled: key === "upwork" || key === "freelancer" ? false : true, sendMode: p.defaultSendMode },
      update: {},
    });
    await prisma.platformLimit.upsert({ where: { organizationId_platformKey: { organizationId: org.id, platformKey: key } }, create: { organizationId: org.id, platformId: p.id, platformKey: key, dailyLimit: 10, hourlyLimit: 3, maxContactsPerClientPerWeek: 1 }, update: {} });
  }
  await prisma.platformLimit.upsert({ where: { organizationId_platformKey: { organizationId: org.id, platformKey: "demo-marketplace" } }, create: { organizationId: org.id, platformId: demoPlatform.id, platformKey: "demo-marketplace", dailyLimit: 200, hourlyLimit: 100, maxContactsPerClientPerWeek: 5 }, update: { dailyLimit: 200, hourlyLimit: 100, maxContactsPerClientPerWeek: 5 } });

  // Automation rules
  const existingRules = await prisma.automationRule.count({ where: { organizationId: org.id } });
  if (existingRules === 0) {
    for (const r of DEFAULT_RULES) await prisma.automationRule.create({ data: { organizationId: org.id, ...r } });
  }

  // 100 demo jobs (NEW, un-analysed → run Discovery/Analysis from the UI or via API)
  const jobs = generateDemoJobs(100);
  let created = 0;
  for (const j of jobs) {
    const exists = await prisma.job.findUnique({ where: { organizationId_platformKey_externalJobId: { organizationId: org.id, platformKey: j.platform, externalJobId: j.job_id } } });
    if (exists) continue;
    let clientId: string | null = null;
    if (j.client_name) {
      const c = await prisma.client.findFirst({ where: { organizationId: org.id, platformKey: j.platform, name: j.client_name } });
      clientId = c ? c.id : (await prisma.client.create({ data: { organizationId: org.id, name: j.client_name, platformKey: j.platform, country: j.client_country, language: j.client_language, rating: j.client_rating, history: j.client_history, paymentVerified: j.payment_verified } })).id;
    }
    const job = await prisma.job.create({
      data: {
        organizationId: org.id, platformKey: j.platform, externalJobId: j.job_id, jobUrl: j.job_url, clientName: j.client_name, clientCountry: j.client_country, clientLanguage: j.client_language,
        projectTitle: j.project_title, projectDescription: j.project_description, category: j.category, requiredSkills: j.required_skills, budgetMin: j.budget_min, budgetMax: j.budget_max, currency: j.currency,
        budgetUsd: toUsd(j.budget_max ?? j.budget_min, j.currency), deadline: j.deadline ? new Date(j.deadline) : null, proposalDeadline: j.proposal_deadline ? new Date(j.proposal_deadline) : null,
        numberOfCompetitors: j.number_of_competitors, clientRating: j.client_rating, clientHistory: j.client_history, paymentVerified: j.payment_verified, postedAt: j.posted_at ? new Date(j.posted_at) : null,
        rawText: j.raw_text, sourceMetadata: j.source_metadata as object, status: "NEW",
      },
    });
    await prisma.opportunity.create({ data: { organizationId: org.id, jobId: job.id, clientId, title: j.project_title, status: "DISCOVERED", currency: j.currency, estimatedValueUsd: toUsd(j.budget_max ?? j.budget_min, j.currency) } });
    created += 1;
  }

  console.log(`Seed complete: org=${org.slug}, users=${users.length}, jobs created=${created}`);
  console.log(`Login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
