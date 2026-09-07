import { prisma } from "../db";
import { getConnector } from "../connectors/registry";
import { decryptJson } from "../crypto";
import { checkSendLimits } from "./limits";
import { buildAgentContext } from "../agents/context";
import { runComplianceAgent } from "../agents/compliance";
import { logAudit } from "../audit";
import { markMemorySent } from "../services/memory";
import { dec } from "../utils";
import { getOrgSettings } from "../settings";
import type { ActorType } from "@prisma/client";

function withinBusinessHours(settings: Awaited<ReturnType<typeof getOrgSettings>>["settings"]): boolean {
  const bh = settings.businessHours;
  if (!bh.restrictSending) return true;
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: bh.timezone, hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    const hm = `${parts.hour}:${parts.minute}`;
    return bh.days.includes(dayIdx) && hm >= bh.start && hm <= bh.end;
  } catch {
    return true;
  }
}

/** Shared finalisation for API-sent and manually-sent proposals. */
export async function finalizeSent(orgId: string, proposalId: string, r: { externalProposalId: string | null; externalThreadId: string | null; actorType: ActorType; actorId: string | null }) {
  const p = await prisma.proposal.findUniqueOrThrow({ where: { id: proposalId }, include: { job: true } });
  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({ where: { id: proposalId }, data: { status: "SENT", sentAt: new Date(), externalProposalId: r.externalProposalId, failedReason: null } });
    await tx.opportunity.update({ where: { id: p.opportunityId }, data: { status: "PROPOSAL_SENT", stageChangedAt: new Date() } });
    const conv = await tx.conversation.upsert({
      where: { opportunityId: p.opportunityId },
      create: { organizationId: orgId, opportunityId: p.opportunityId, platformKey: p.platformKey, externalThreadId: r.externalThreadId, clientLanguage: p.detectedLanguage, lastMessageAt: new Date(), pricingState: { currentOfferUsd: dec(p.proposedPriceUsd), discountAppliedPct: 0, rounds: 0, scopeAdjustments: [] } },
      update: { externalThreadId: r.externalThreadId ?? undefined, lastMessageAt: new Date() },
    });
    await tx.message.create({ data: { organizationId: orgId, conversationId: conv.id, direction: "OUTBOUND", authorType: r.actorType === "USER" ? "HUMAN" : "AI", authorUserId: r.actorType === "USER" ? r.actorId : null, language: p.detectedLanguage, body: p.proposalTranslated, bodyTranslated: p.proposalOriginal !== p.proposalTranslated ? p.proposalOriginal : null, approvalStatus: "APPROVED", sentAt: new Date(), externalMessageId: r.externalProposalId } });
    await tx.activity.create({ data: { organizationId: orgId, opportunityId: p.opportunityId, type: "PROPOSAL_SENT", title: `Proposal sent via ${p.platformKey}${r.actorType === "USER" ? " (manual)" : ""}`, actorType: r.actorType, actorId: r.actorId } });
  });
  await markMemorySent(proposalId);
  await logAudit({ orgId, actorType: r.actorType, actorId: r.actorId, userId: r.actorType === "USER" ? r.actorId : null, agent: r.actorType === "AI" ? "send-engine" : null, action: "proposal.sent", entityType: "proposal", entityId: proposalId, after: { platformKey: p.platformKey, externalProposalId: r.externalProposalId, language: p.detectedLanguage, priceUsd: dec(p.proposedPriceUsd) } });
}

/**
 * Send Engine: APPROVED → (compliance + limits + business hours) → connector.sendProposal → SENT | SCHEDULED | FAILED.
 * MANUAL_ONLY platforms are never sent by the system.
 */
export async function sendProposal(orgId: string, proposalId: string, actorUserId: string | null): Promise<{ status: string; reason?: string }> {
  const p = await prisma.proposal.findFirstOrThrow({ where: { id: proposalId, organizationId: orgId }, include: { job: true, opportunity: true } });
  if (p.status === "SENT" || p.status === "REPLIED") return { status: p.status, reason: "already sent" };
  if (p.status !== "APPROVED" && p.status !== "SCHEDULED") return { status: p.status, reason: "not approved" };
  const connector = getConnector(p.platformKey);
  const account = await prisma.platformAccount.findUnique({ where: { organizationId_platformKey: { organizationId: orgId, platformKey: p.platformKey } } });
  const sendMode = account?.sendMode ?? connector.compliance.defaultSendMode;
  if (sendMode === "MANUAL_ONLY" || !connector.capabilities.sendProposal || !connector.sendProposal) {
    await prisma.proposal.update({ where: { id: proposalId }, data: { status: "APPROVED", failedReason: "MANUAL_ONLY: copy the proposal into the marketplace and mark as sent" } });
    return { status: "APPROVED", reason: "manual sending required" };
  }
  const ctx = await buildAgentContext(orgId, actorUserId);
  if (!withinBusinessHours(ctx.settings)) {
    await prisma.proposal.update({ where: { id: proposalId }, data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() + 3600 * 1000) } });
    return { status: "SCHEDULED", reason: "outside business hours" };
  }
  const limits = await checkSendLimits(orgId, p.platformKey, p.opportunity.clientId);
  if (!limits.ok) {
    await prisma.proposal.update({ where: { id: proposalId }, data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() + 3600 * 1000), failedReason: limits.violations.map((v) => v.message).join("; ") } });
    await logAudit({ orgId, actorType: "SYSTEM", agent: "send-engine", action: "proposal.scheduled", entityType: "proposal", entityId: proposalId, reason: limits.violations.map((v) => v.code).join(",") });
    return { status: "SCHEDULED", reason: limits.violations.map((v) => v.message).join("; ") };
  }
  const compliance = await runComplianceAgent(ctx, { text: p.proposalTranslated, platformKey: p.platformKey, jobId: p.jobId, clientId: p.opportunity.clientId, skipLimits: true });
  if (!compliance.allowed) {
    await prisma.proposal.update({ where: { id: proposalId }, data: { status: "AI_REVIEWED", failedReason: compliance.issues.filter((i) => i.severity === "BLOCK").map((i) => i.message).join("; "), complianceResult: compliance as object } });
    await logAudit({ orgId, actorType: "AI", agent: "compliance", action: "proposal.blocked", entityType: "proposal", entityId: proposalId, after: { issues: compliance.issues } });
    return { status: "AI_REVIEWED", reason: "compliance blocked" };
  }
  const cctx = { orgId, platformAccountId: account?.id ?? "", credentials: decryptJson<Record<string, string>>(account?.credentialsEncrypted) ?? {}, config: (account?.config ?? {}) as Record<string, unknown> };
  try {
    const result = await connector.sendProposal(cctx, { jobExternalId: p.job.externalJobId, text: p.proposalTranslated, price: p.proposedPrice ? dec(p.proposedPrice) : null, currency: p.currency, deliveryDays: p.proposedDeliveryDays, language: p.detectedLanguage, reference: p.id });
    if (!result.ok) throw new Error(result.error ?? "send failed");
    await finalizeSent(orgId, proposalId, { externalProposalId: result.externalProposalId ?? null, externalThreadId: result.externalThreadId ?? null, actorType: actorUserId ? "USER" : "AI", actorId: actorUserId ?? "send-engine" });
    return { status: "SENT" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await prisma.proposal.update({ where: { id: proposalId }, data: { status: "FAILED", failedReason: reason } });
    await logAudit({ orgId, actorType: "SYSTEM", agent: "send-engine", action: "proposal.failed", entityType: "proposal", entityId: proposalId, reason });
    return { status: "FAILED", reason };
  }
}

/** Retry SCHEDULED proposals whose time has come (called by worker). */
export async function flushScheduled(orgId?: string) {
  const due = await prisma.proposal.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() }, ...(orgId ? { organizationId: orgId } : {}) }, take: 50 });
  const out: { id: string; status: string }[] = [];
  for (const p of due) {
    await prisma.proposal.update({ where: { id: p.id }, data: { status: "APPROVED" } });
    const r = await sendProposal(p.organizationId, p.id, null);
    out.push({ id: p.id, status: r.status });
  }
  return out;
}
