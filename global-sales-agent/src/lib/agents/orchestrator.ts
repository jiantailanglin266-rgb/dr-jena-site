import { prisma } from "../db";
import { getOrgSettings } from "../settings";
import { runAutomationRules, type RuleContext } from "../automation/engine";
import { dec } from "../utils";
import { logAudit } from "../audit";

export type PipelineEvent =
  | { type: "JOB_DISCOVERED"; jobId: string }
  | { type: "JOB_ANALYZED"; jobId: string; qualified: boolean }
  | { type: "PROPOSAL_DRAFTED"; proposalId: string }
  | { type: "PROPOSAL_APPROVED"; proposalId: string; actorUserId?: string | null }
  | { type: "REPLY_RECEIVED"; messageId: string; hint?: string | null }
  | { type: "REPLY_ANALYZED"; messageId: string; conversationId: string; opportunityId: string; category: string }
  | { type: "VERBAL_ACCEPT"; opportunityId: string }
  | { type: "DEAL_APPROVED"; dealId: string };

async function baseRuleContext(orgId: string): Promise<Pick<RuleContext, "org">> {
  const { settings, plan } = await getOrgSettings(orgId);
  return { org: { automationLevel: settings.automationLevel, plan, autoSendEnabled: settings.autoSendEnabled } };
}

async function jobContext(orgId: string, jobId: string): Promise<RuleContext> {
  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, organizationId: orgId }, include: { analysis: true, opportunity: true, proposal: true } });
  const base = await baseRuleContext(orgId);
  return {
    ...base,
    job: { budgetMin: dec(job.budgetMin), budgetMax: dec(job.budgetMax), budgetUsd: job.budgetUsd ? dec(job.budgetUsd) : null, currency: job.currency, category: job.category, clientCountry: job.clientCountry, clientLanguage: job.clientLanguage, clientRating: job.clientRating ? dec(job.clientRating) : null, paymentVerified: job.paymentVerified, competitors: job.numberOfCompetitors, platformKey: job.platformKey, requiredSkills: job.requiredSkills, status: job.status },
    analysis: job.analysis ? { fitScore: job.analysis.fitScore, profitScore: job.analysis.profitScore, clientQualityScore: job.analysis.clientQualityScore, winProbability: job.analysis.winProbability, urgencyScore: job.analysis.urgencyScore, riskScore: job.analysis.riskScore, competitionScore: job.analysis.competitionScore, opportunityScore: job.analysis.opportunityScore, estimatedHours: job.analysis.estimatedHours, riskFlags: job.analysis.riskFlags, recommendedAction: job.analysis.recommendedAction } : undefined,
    opportunity: job.opportunity ? { status: job.opportunity.status } : undefined,
    proposal: job.proposal ? { status: job.proposal.status, sendMode: job.proposal.sendMode } : undefined,
    ids: { jobId: job.id, opportunityId: job.opportunity?.id, proposalId: job.proposal?.id },
  };
}

/**
 * Supervisor Agent / Orchestration Layer — single entry point for pipeline events.
 * Runs automation rules first; applies built-in defaults according to automation level when no rule handled the event.
 */
export async function dispatch(orgId: string, event: PipelineEvent): Promise<void> {
  const { enqueue } = await import("../queue");
  switch (event.type) {
    case "JOB_DISCOVERED": {
      await enqueue("analyze_job", { orgId, jobId: event.jobId });
      return;
    }
    case "JOB_ANALYZED": {
      const ctx = await jobContext(orgId, event.jobId);
      await runAutomationRules(orgId, "JOB_ANALYZED", ctx, { type: "job", id: event.jobId });
      if (event.qualified) await runAutomationRules(orgId, "JOB_QUALIFIED", ctx, { type: "job", id: event.jobId });
      return;
    }
    case "PROPOSAL_DRAFTED": {
      const proposal = await prisma.proposal.findFirstOrThrow({ where: { id: event.proposalId, organizationId: orgId } });
      const ctx = await jobContext(orgId, proposal.jobId);
      await runAutomationRules(orgId, "PROPOSAL_DRAFTED", ctx, { type: "proposal", id: proposal.id });
      const fresh = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
      if (fresh.status === "APPROVED") await enqueue("send_proposal", { orgId, proposalId: fresh.id });
      return;
    }
    case "PROPOSAL_APPROVED": {
      await enqueue("send_proposal", { orgId, proposalId: event.proposalId, actorUserId: event.actorUserId ?? null });
      return;
    }
    case "REPLY_RECEIVED": {
      await enqueue("process_inbound", { orgId, messageId: event.messageId, hint: event.hint ?? null });
      return;
    }
    case "REPLY_ANALYZED": {
      const msg = await prisma.message.findFirstOrThrow({ where: { id: event.messageId, organizationId: orgId } });
      const opp = await prisma.opportunity.findFirstOrThrow({ where: { id: event.opportunityId }, include: { job: { include: { analysis: true } }, proposal: true } });
      const base = await baseRuleContext(orgId);
      const analysis = (msg.analysis ?? {}) as Record<string, unknown>;
      const ctx: RuleContext = {
        ...base,
        job: { category: opp.job.category, clientCountry: opp.job.clientCountry, clientLanguage: opp.job.clientLanguage, platformKey: opp.job.platformKey, budgetUsd: opp.job.budgetUsd ? dec(opp.job.budgetUsd) : null },
        analysis: opp.job.analysis ? { opportunityScore: opp.job.analysis.opportunityScore, fitScore: opp.job.analysis.fitScore, riskScore: opp.job.analysis.riskScore } : undefined,
        reply: { category: event.category, sentiment: analysis.sentiment, intent: analysis.intent, purchaseProbability: analysis.purchase_probability, urgency: analysis.urgency },
        opportunity: { status: opp.status },
        proposal: opp.proposal ? { status: opp.proposal.status, sendMode: opp.proposal.sendMode } : undefined,
        ids: { jobId: opp.jobId, opportunityId: opp.id, proposalId: opp.proposal?.id, conversationId: event.conversationId, messageId: event.messageId },
      };
      const { matchedAny } = await runAutomationRules(orgId, "REPLY_ANALYZED", ctx, { type: "message", id: event.messageId });
      if (!matchedAny && base.org.automationLevel !== "MANUAL") {
        // Built-in supervisor defaults
        switch (event.category) {
          case "PRICE_NEGOTIATION":
            await enqueue("negotiate_reply", { orgId, conversationId: event.conversationId });
            break;
          case "ACCEPTANCE":
            await dispatch(orgId, { type: "VERBAL_ACCEPT", opportunityId: event.opportunityId });
            break;
          case "REJECTION":
            break; // status already LOST via conversations service; humans may still reply
          default:
            await enqueue("generate_reply", { orgId, conversationId: event.conversationId });
        }
        await logAudit({ orgId, actorType: "AI", agent: "supervisor", action: `supervisor.default:${event.category}`, entityType: "message", entityId: event.messageId });
      }
      return;
    }
    case "VERBAL_ACCEPT": {
      const base = await baseRuleContext(orgId);
      const ctx: RuleContext = { ...base, ids: { opportunityId: event.opportunityId } };
      const { matchedAny } = await runAutomationRules(orgId, "VERBAL_ACCEPT", ctx, { type: "opportunity", id: event.opportunityId });
      if (!matchedAny) await enqueue("deal_summary", { orgId, opportunityId: event.opportunityId });
      return;
    }
    case "DEAL_APPROVED":
      return;
  }
}
