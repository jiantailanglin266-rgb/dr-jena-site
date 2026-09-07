import { prisma } from "../db";
import { runJson } from "../ai/provider";
import { proposalSchema, type ProposalOutput } from "./schemas";
import { getPrompt, renderPrompt } from "./prompts";
import { profileForPrompt, type AgentContext } from "./context";
import { jobForPrompt } from "./analyst";
import { resolveTargetLanguage } from "../language/layer";
import { runTranslationAgent } from "./translation";
import { runComplianceAgent } from "./compliance";
import { assembleProposalText } from "../ai/mock/generators";
import { getMemoryInsights, recordProposalFeatures, pricePosition } from "../services/memory";
import { logAudit } from "../audit";
import { toUsd } from "../currency";
import { dec } from "../utils";
import { enforceFloor } from "../pricing/engine";
import { getConnector } from "../connectors/registry";
import type { ProposalLength, ProposalTone, Proposal } from "@prisma/client";

export interface ProposalOptions {
  length?: ProposalLength;
  tone?: ProposalTone;
  language?: string;
  variantLabel?: string;
  regenerate?: boolean;
  changeReason?: string;
}

/**
 * Proposal Agent: fully individualised proposal → Translation (Language Layer) → Compliance → Proposal record.
 * Never sends. Status: DRAFT → AI_REVIEWED → (WAITING_APPROVAL | APPROVED per send mode / automation level).
 */
export async function runProposalAgent(ctx: AgentContext, jobId: string, opts: ProposalOptions = {}): Promise<Proposal> {
  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, organizationId: ctx.orgId }, include: { analysis: true, opportunity: true } });
  if (!job.analysis) throw new Error("Job must be analysed before generating a proposal");
  if (!job.opportunity) throw new Error("Opportunity missing for job");
  const existing = await prisma.proposal.findUnique({ where: { jobId } });
  if (existing && !opts.regenerate) {
    if (existing.status === "SENT" || existing.status === "REPLIED" || existing.status === "CLOSED") throw new Error("Proposal already sent for this job (duplicate sending is not allowed)");
    return existing;
  }
  if (existing && ["SENT", "REPLIED", "CLOSED"].includes(existing.status)) throw new Error("Cannot regenerate a sent proposal");

  const length = opts.length ?? ctx.settings.defaultProposalLength;
  const tone = opts.tone ?? ctx.settings.salesTone;
  const sourceLanguage = ctx.settings.defaultLanguage;
  const lang = resolveTargetLanguage({ clientLanguage: opts.language ?? job.clientLanguage ?? job.analysis.detectedLanguage, text: job.projectDescription, orgDefault: sourceLanguage, sourceLanguage });
  const targetLanguage = lang.targetLanguage;

  // A/B variant assignment
  let variant = opts.variantLabel ?? "A";
  if (!opts.variantLabel && ctx.settings.abTesting.enabled) {
    const count = await prisma.proposal.count({ where: { organizationId: ctx.orgId } });
    variant = (count * 100) % 100 < ctx.settings.abTesting.variantBSharePct * 1 ? "B" : count % 100 < ctx.settings.abTesting.variantBSharePct ? "B" : "A";
  }

  const profile = profileForPrompt(ctx.profile);
  const memory = await getMemoryInsights(ctx.orgId, { platformKey: job.platformKey, category: job.category, language: targetLanguage });
  const analysisRaw = job.analysis.raw as Record<string, unknown>;
  const pricing = ctx.settings.pricing;
  const prompt = await getPrompt(ctx.orgId, "proposal");
  const jobView = jobForPrompt(job);
  const analysisView = { ...analysisRaw, fit_score: job.analysis.fitScore, opportunity_score: job.analysis.opportunityScore, estimated_hours: job.analysis.estimatedHours, estimated_market_price: dec(job.analysis.estimatedMarketPrice), required_deliverables: job.analysis.requiredDeliverables };

  const { data, aiRunId } = await runJson(
    ctx.ai,
    proposalSchema,
    {
      agent: "proposal",
      purpose: "generate_proposal",
      system: prompt.system.replace("{{tone}}", tone),
      messages: [{ role: "user", content: renderPrompt(prompt.user, { company: profile, job: jobView, analysis: analysisView, pricing, memory: memory.notes, language: targetLanguage, length, tone, variant }) }],
      context: { job: jobView, analysis: analysisView, profile, tone, length, language: targetLanguage, pricing, memoryInsights: memory, variant },
      maxTokens: 6000,
    },
    { entityType: "job", entityId: job.id },
  );

  // Pricing floor enforced in code regardless of what the model produced
  const currency = data.currency || job.currency;
  const priceUsd = toUsd(data.proposed_price, currency) ?? 0;
  const flooredUsd = enforceFloor(priceUsd, pricing);
  const finalPriceLocal = flooredUsd !== priceUsd ? Math.round(data.proposed_price * (flooredUsd / Math.max(priceUsd, 1))) : data.proposed_price;

  const clientName = job.clientName ?? "";
  const textTarget = assembleProposalText(data, tone, { client: clientName, company: ctx.profile.companyName, title: job.projectTitle }, targetLanguage);
  // Language Layer: keep an "original" in the org's default language as well as the client-language version
  let proposalOriginal = textTarget;
  const proposalTranslated = textTarget;
  if (targetLanguage !== sourceLanguage) {
    const back = await runTranslationAgent(ctx, { text: textTarget, targetLanguage: sourceLanguage, sourceLanguage: targetLanguage, entityType: "job", entityId: job.id });
    proposalOriginal = back.translated;
  }

  const compliance = await runComplianceAgent(ctx, { text: proposalTranslated, platformKey: job.platformKey, jobId: job.id, clientId: job.opportunity.clientId, skipLimits: true });
  const connector = getConnector(job.platformKey);
  const account = await prisma.platformAccount.findUnique({ where: { organizationId_platformKey: { organizationId: ctx.orgId, platformKey: job.platformKey } } });
  const sendMode = account?.sendMode ?? connector.compliance.defaultSendMode;
  const autoApprove = compliance.allowed && sendMode === "AUTO" && ctx.settings.autoSendEnabled && ["SEMI_AUTO", "FULL_AUTO"].includes(ctx.settings.automationLevel);
  const status = !compliance.allowed ? "AI_REVIEWED" : autoApprove ? "APPROVED" : "WAITING_APPROVAL";

  const proposal = await prisma.$transaction(async (tx) => {
    const base = {
      platformKey: job.platformKey, status, sendMode, length, tone, variantLabel: variant, detectedLanguage: targetLanguage, sourceLanguage,
      proposalOriginal, proposalTranslated, structured: { ...data, proposed_price: finalPriceLocal } as object, proposedPriceUsd: flooredUsd, proposedPrice: finalPriceLocal, currency,
      proposedDeliveryDays: data.delivery_days, complianceResult: compliance as object, aiRunId, approvedAt: autoApprove ? new Date() : null, approvedByUserId: null,
    } as const;
    const p = existing
      ? await tx.proposal.update({ where: { id: existing.id }, data: base })
      : await tx.proposal.create({ data: { organizationId: ctx.orgId, jobId: job.id, opportunityId: job.opportunity!.id, ...base } });
    const version = (await tx.proposalVersion.count({ where: { proposalId: p.id } })) + 1;
    await tx.proposalVersion.create({ data: { organizationId: ctx.orgId, proposalId: p.id, version, proposalOriginal, proposalTranslated, structured: data as object, length, tone, changeReason: opts.changeReason ?? (existing ? "regenerated" : "initial"), authorType: "AI" } });
    await tx.opportunity.update({ where: { id: job.opportunity!.id }, data: { status: "PROPOSAL_CREATED", estimatedValueUsd: flooredUsd, stageChangedAt: new Date() } });
    await tx.activity.create({ data: { organizationId: ctx.orgId, opportunityId: job.opportunity!.id, type: "PROPOSAL_CREATED", title: `Proposal ${existing ? "regenerated" : "created"} (${length}/${tone}/${targetLanguage})`, actorType: "AI", actorId: "proposal-agent" } });
    return p;
  });

  await recordProposalFeatures({
    orgId: ctx.orgId, proposalId: proposal.id, platformKey: job.platformKey, category: job.category, country: job.clientCountry, language: targetLanguage, tone, length,
    openingStyle: data.opening_style, ctaType: data.cta_type, pricePosition: pricePosition(flooredUsd, dec(job.analysis.estimatedMarketPrice)), hasPortfolio: data.has_portfolio, variantLabel: variant,
  });
  if (autoApprove) await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "supervisor", action: "proposal.approved", entityType: "proposal", entityId: proposal.id, reason: `auto-approved: sendMode=AUTO, automationLevel=${ctx.settings.automationLevel}, compliance ok` });
  await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "proposal", action: "proposal.generated", entityType: "proposal", entityId: proposal.id, after: { status, sendMode, language: targetLanguage, priceUsd: flooredUsd, compliance: compliance.issues.map((i) => i.code) } });
  return proposal;
}

export type { ProposalOutput };
