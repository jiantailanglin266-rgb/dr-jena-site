import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { conditionSchema, evaluateConditions } from "@/lib/automation/conditions";
import { dec } from "@/lib/utils";

/** Dry-run conditions against analysed jobs in this org — returns match count + samples. */
export const POST = withAuth("automation:read", async (req, { user }) => {
  const b = await parseBody(req, z.object({ conditions: z.array(conditionSchema) }));
  const jobs = await prisma.job.findMany({ where: { organizationId: user.orgId, analysis: { isNot: null } }, include: { analysis: true, opportunity: true, proposal: true }, take: 500 });
  const matched = jobs.filter((job) => evaluateConditions(b.conditions, {
    job: { budgetUsd: job.budgetUsd ? dec(job.budgetUsd) : null, category: job.category, clientCountry: job.clientCountry, clientLanguage: job.clientLanguage, clientRating: job.clientRating ? dec(job.clientRating) : null, paymentVerified: job.paymentVerified, competitors: job.numberOfCompetitors, platformKey: job.platformKey, requiredSkills: job.requiredSkills },
    analysis: job.analysis ? { fitScore: job.analysis.fitScore, profitScore: job.analysis.profitScore, clientQualityScore: job.analysis.clientQualityScore, winProbability: job.analysis.winProbability, urgencyScore: job.analysis.urgencyScore, riskScore: job.analysis.riskScore, opportunityScore: job.analysis.opportunityScore, estimatedHours: job.analysis.estimatedHours, riskFlags: job.analysis.riskFlags } : undefined,
    opportunity: job.opportunity ? { status: job.opportunity.status } : undefined,
    proposal: job.proposal ? { status: job.proposal.status, sendMode: job.proposal.sendMode } : undefined,
  }));
  return ok({ evaluated: jobs.length, matched: matched.length, samples: matched.slice(0, 10).map((j) => ({ id: j.id, title: j.projectTitle, score: j.analysis?.opportunityScore })) });
});
