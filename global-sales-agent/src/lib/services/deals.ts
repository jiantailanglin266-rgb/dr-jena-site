import { prisma } from "../db";
import { buildAgentContext } from "../agents/context";
import { runClosingAgent } from "../agents/closing";
import { logAudit } from "../audit";
import { markMemoryWon } from "./memory";
import { ApiError } from "../errors";
import { dec } from "../utils";
import type { Prisma } from "@prisma/client";

export async function createDealSummary(orgId: string, opportunityId: string, actorUserId?: string | null) {
  const ctx = await buildAgentContext(orgId, actorUserId);
  return runClosingAgent(ctx, opportunityId);
}

/** Human confirms the deal → WON → CRM sync. AI never calls this. */
export async function approveDeal(orgId: string, dealId: string, userId: string, edits?: { checklist?: { key: string; confirmed: boolean; value?: string | null }[]; amount?: number; notes?: string }) {
  const deal = await prisma.deal.findFirstOrThrow({ where: { id: dealId, organizationId: orgId }, include: { opportunity: { include: { job: true, proposal: true, client: true } } } });
  if (deal.status === "WON") return deal;
  const checklist = (deal.checklist as { key: string; label: string; confirmed: boolean; value: string | null }[]).map((c) => {
    const e = edits?.checklist?.find((x) => x.key === c.key);
    return e ? { ...c, confirmed: e.confirmed, value: e.value ?? c.value } : c;
  });
  const unconfirmed = checklist.filter((c) => !c.confirmed).map((c) => c.key);
  if (unconfirmed.length) throw new ApiError(`Cannot mark WON: unconfirmed items — ${unconfirmed.join(", ")}`, 409, { unconfirmed });
  const amount = edits?.amount ?? dec(deal.amount);
  const amountUsd = edits?.amount ? (await import("../currency")).toUsd(edits.amount, deal.currency) ?? dec(deal.amountUsd) : dec(deal.amountUsd);
  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.deal.update({ where: { id: dealId }, data: { status: "WON", wonAt: new Date(), approvedByUserId: userId, approvedAt: new Date(), amount, amountUsd, checklist: checklist as unknown as Prisma.InputJsonValue, summary: { ...(deal.summary as object), notes: edits?.notes ?? null, approvedBy: userId } as Prisma.InputJsonValue } });
    await tx.opportunity.update({ where: { id: deal.opportunityId }, data: { status: "WON", stageChangedAt: new Date(), estimatedValueUsd: amountUsd } });
    if (deal.opportunity.proposal) await tx.proposal.update({ where: { id: deal.opportunity.proposal.id }, data: { status: "CLOSED" } });
    // CRM sync
    let clientId = deal.clientId ?? deal.opportunity.clientId;
    if (!clientId) {
      const c = await tx.client.create({ data: { organizationId: orgId, name: deal.opportunity.job.clientName ?? deal.title, platformKey: deal.opportunity.job.platformKey, country: deal.opportunity.job.clientCountry, language: deal.opportunity.job.clientLanguage } });
      clientId = c.id;
      await tx.opportunity.update({ where: { id: deal.opportunityId }, data: { clientId } });
      await tx.deal.update({ where: { id: dealId }, data: { clientId } });
    }
    await tx.client.update({ where: { id: clientId }, data: { totalWonValueUsd: { increment: amountUsd } } });
    const contactExists = await tx.contact.findFirst({ where: { clientId } });
    if (!contactExists) await tx.contact.create({ data: { organizationId: orgId, clientId, name: deal.opportunity.job.clientName ?? "Primary contact", language: deal.opportunity.job.clientLanguage, role: "Decision maker" } });
    await tx.task.updateMany({ where: { opportunityId: deal.opportunityId, status: "OPEN" }, data: { status: "DONE" } });
    await tx.task.create({ data: { organizationId: orgId, opportunityId: deal.opportunityId, title: `Kick-off: ${deal.title}`, description: "Deal WON — schedule kick-off and send contract/invoice." } });
    await tx.activity.create({ data: { organizationId: orgId, opportunityId: deal.opportunityId, type: "DEAL_WON", title: `Deal WON — ${amount} ${deal.currency}`, actorType: "USER", actorId: userId } });
    return d;
  });
  await markMemoryWon(deal.opportunity.proposal?.id ?? "");
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "deal.won", entityType: "deal", entityId: dealId, before: { status: deal.status }, after: { status: "WON", amountUsd, checklist: checklist.map((c) => c.key) } });
  return updated;
}

export async function markLost(orgId: string, opportunityId: string, userId: string, reason: string) {
  const opp = await prisma.opportunity.findFirstOrThrow({ where: { id: opportunityId, organizationId: orgId }, include: { deal: true } });
  await prisma.$transaction([
    prisma.opportunity.update({ where: { id: opportunityId }, data: { status: "LOST", lostReason: reason, stageChangedAt: new Date() } }),
    ...(opp.deal ? [prisma.deal.update({ where: { id: opp.deal.id }, data: { status: "LOST", lostAt: new Date() } })] : []),
    prisma.activity.create({ data: { organizationId: orgId, opportunityId, type: "DEAL_LOST", title: `Marked LOST: ${reason}`, actorType: "USER", actorId: userId } }),
  ]);
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "opportunity.lost", entityType: "opportunity", entityId: opportunityId, before: { status: opp.status }, after: { status: "LOST" }, reason });
}

export async function updateLeadStatus(orgId: string, opportunityId: string, userId: string, status: string) {
  if (status === "WON") throw new ApiError("Use deal approval to mark WON", 409);
  const opp = await prisma.opportunity.findFirstOrThrow({ where: { id: opportunityId, organizationId: orgId } });
  const updated = await prisma.opportunity.update({ where: { id: opportunityId }, data: { status: status as never, stageChangedAt: new Date() } });
  await prisma.activity.create({ data: { organizationId: orgId, opportunityId, type: "STAGE_CHANGED", title: `Stage → ${status} (manual)`, actorType: "USER", actorId: userId } });
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "opportunity.status", entityType: "opportunity", entityId: opportunityId, before: { status: opp.status }, after: { status } });
  return updated;
}
