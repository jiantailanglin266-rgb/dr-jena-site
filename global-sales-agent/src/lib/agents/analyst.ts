import { prisma } from "../db";
import { runJson } from "../ai/provider";
import { jobAnalysisSchema } from "./schemas";
import { computeOpportunityScore } from "../scoring/opportunity";
import { getPrompt, renderPrompt } from "./prompts";
import { profileForPrompt, type AgentContext } from "./context";
import { logAudit } from "../audit";
import { dec } from "../utils";
import { detectLanguage } from "../language/detect";
import type { Job, JobAnalysis } from "@prisma/client";

export function jobForPrompt(job: Job) {
  return {
    platform: job.platformKey,
    title: job.projectTitle,
    description: job.projectDescription,
    category: job.category,
    requiredSkills: job.requiredSkills,
    budgetMin: job.budgetMin ? dec(job.budgetMin) : null,
    budgetMax: job.budgetMax ? dec(job.budgetMax) : null,
    currency: job.currency,
    budgetUsd: job.budgetUsd ? dec(job.budgetUsd) : null,
    deadline: job.deadline?.toISOString() ?? null,
    proposalDeadline: job.proposalDeadline?.toISOString() ?? null,
    competitors: job.numberOfCompetitors,
    clientName: job.clientName,
    clientCountry: job.clientCountry,
    clientLanguage: job.clientLanguage,
    clientRating: job.clientRating ? dec(job.clientRating) : null,
    clientHistory: job.clientHistory,
    paymentVerified: job.paymentVerified,
    postedAt: job.postedAt?.toISOString() ?? null,
  };
}

/** Analyst Agent: analyse a job, compute scores, persist JobAnalysis and update job status. */
export async function runAnalystAgent(ctx: AgentContext, jobId: string): Promise<{ analysis: JobAnalysis; qualified: boolean }> {
  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, organizationId: ctx.orgId } });
  const profile = profileForPrompt(ctx.profile);
  const prompt = await getPrompt(ctx.orgId, "analyst");
  const jobView = jobForPrompt(job);
  const { data, aiRunId } = await runJson(
    ctx.ai,
    jobAnalysisSchema,
    {
      agent: "analyst",
      purpose: "analyze_job",
      system: prompt.system,
      messages: [{ role: "user", content: renderPrompt(prompt.user, { company: profile, job: jobView }) }],
      context: { job: jobView, profile },
      maxTokens: 3000,
    },
    { entityType: "job", entityId: job.id },
  );
  const scores = computeOpportunityScore(data);
  const detected = job.clientLanguage || data.detected_language || detectLanguage(job.projectDescription);

  // Hard exclusions from org settings (keywords / minimum budget)
  const text = `${job.projectTitle} ${job.projectDescription}`.toLowerCase();
  const excludedKw = [...ctx.settings.excludeKeywords, ...ctx.profile.excludeKeywords].find((k) => k && text.includes(k.toLowerCase()));
  const budgetUsd = job.budgetUsd ? dec(job.budgetUsd) : null;
  const belowMin = budgetUsd !== null && budgetUsd > 0 && budgetUsd < ctx.settings.minJobBudgetUsd;
  const countryMismatch = ctx.settings.targetCountries.length > 0 && job.clientCountry && !ctx.settings.targetCountries.includes(job.clientCountry);
  const categoryMismatch = ctx.settings.targetCategories.length > 0 && job.category && !ctx.settings.targetCategories.includes(job.category);

  let qualified = scores.opportunityScore >= ctx.settings.minOpportunityScore && data.recommended_action !== "SKIP";
  let excludedReason: string | null = null;
  if (excludedKw) { qualified = false; excludedReason = `exclude_keyword:${excludedKw}`; }
  else if (belowMin) { qualified = false; excludedReason = `budget_below_minimum:${budgetUsd}<${ctx.settings.minJobBudgetUsd}`; }
  else if (countryMismatch) { qualified = false; excludedReason = `country_not_targeted:${job.clientCountry}`; }
  else if (categoryMismatch) { qualified = false; excludedReason = `category_not_targeted:${job.category}`; }
  else if (!qualified) excludedReason = `opportunity_score_below_threshold:${scores.opportunityScore}<${ctx.settings.minOpportunityScore}`;

  const analysis = await prisma.$transaction(async (tx) => {
    const a = await tx.jobAnalysis.upsert({
      where: { jobId: job.id },
      create: {
        organizationId: ctx.orgId,
        jobId: job.id,
        summary: data.summary,
        clientGoal: data.client_goal,
        requiredDeliverables: data.required_deliverables,
        requiredSkills: data.required_skills,
        preferredSkills: data.preferred_skills,
        estimatedDifficulty: data.estimated_difficulty,
        estimatedHours: Math.round(data.estimated_hours),
        estimatedMarketPrice: data.estimated_market_price,
        urgencyScore: scores.urgencyScore,
        clientQualityScore: scores.clientQualityScore,
        competitionScore: scores.competitionScore,
        winProbability: scores.winProbability,
        riskFlags: data.risk_flags,
        recommendedAction: data.recommended_action,
        fitScore: scores.fitScore,
        profitScore: scores.profitScore,
        riskScore: scores.riskScore,
        opportunityScore: scores.opportunityScore,
        detectedLanguage: detected,
        raw: data,
        aiRunId,
      },
      update: {
        summary: data.summary, clientGoal: data.client_goal, requiredDeliverables: data.required_deliverables, requiredSkills: data.required_skills,
        preferredSkills: data.preferred_skills, estimatedDifficulty: data.estimated_difficulty, estimatedHours: Math.round(data.estimated_hours),
        estimatedMarketPrice: data.estimated_market_price, urgencyScore: scores.urgencyScore, clientQualityScore: scores.clientQualityScore,
        competitionScore: scores.competitionScore, winProbability: scores.winProbability, riskFlags: data.risk_flags, recommendedAction: data.recommended_action,
        fitScore: scores.fitScore, profitScore: scores.profitScore, riskScore: scores.riskScore, opportunityScore: scores.opportunityScore,
        detectedLanguage: detected, raw: data, aiRunId,
      },
    });
    await tx.job.update({ where: { id: job.id }, data: { status: qualified ? "QUALIFIED" : "EXCLUDED", excludedReason, clientLanguage: detected, ...(!job.category && data.inferred_category ? { category: data.inferred_category } : {}) } });
    const opp = await tx.opportunity.findUnique({ where: { jobId: job.id } });
    if (opp && opp.status === "DISCOVERED") {
      await tx.opportunity.update({ where: { id: opp.id }, data: { status: qualified ? "QUALIFIED" : "LOST", lostReason: qualified ? null : excludedReason, estimatedValueUsd: budgetUsd ?? data.estimated_market_price, stageChangedAt: new Date() } });
    }
    return a;
  });

  await logAudit({
    orgId: ctx.orgId, actorType: "AI", agent: "analyst", action: qualified ? "job.qualified" : "job.excluded", entityType: "job", entityId: job.id,
    after: { opportunityScore: scores.opportunityScore, fitScore: scores.fitScore, riskScore: scores.riskScore, recommendedAction: data.recommended_action, excludedReason }, reason: excludedReason,
  });
  return { analysis, qualified };
}
