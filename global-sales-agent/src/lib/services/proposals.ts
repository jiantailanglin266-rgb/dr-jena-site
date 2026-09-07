import { prisma } from "../db";
import { buildAgentContext } from "../agents/context";
import { runProposalAgent, type ProposalOptions } from "../agents/proposal";
import { dispatch } from "../agents/orchestrator";
import { logAudit } from "../audit";
import { ApiError } from "../errors";
import type { Prisma, ProposalStatus } from "@prisma/client";

export async function createProposal(orgId: string, jobId: string, options: ProposalOptions = {}, actorUserId?: string | null) {
  const ctx = await buildAgentContext(orgId, actorUserId);
  const proposal = await runProposalAgent(ctx, jobId, options);
  await dispatch(orgId, { type: "PROPOSAL_DRAFTED", proposalId: proposal.id });
  return prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
}

export async function listProposals(orgId: string, f: { status?: ProposalStatus; platformKey?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, f.pageSize ?? 25);
  const where: Prisma.ProposalWhereInput = { organizationId: orgId, ...(f.status ? { status: f.status } : {}), ...(f.platformKey ? { platformKey: f.platformKey } : {}) };
  const [items, total] = await Promise.all([
    prisma.proposal.findMany({ where, include: { job: { select: { id: true, projectTitle: true, clientName: true, clientCountry: true, category: true, currency: true } }, opportunity: { select: { id: true, status: true } } }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.proposal.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getProposal(orgId: string, id: string) {
  return prisma.proposal.findFirst({ where: { id, organizationId: orgId }, include: { job: { include: { analysis: true } }, opportunity: { include: { conversation: true, client: true } }, versions: { orderBy: { version: "desc" } } } });
}

/** Human (or automation on AUTO platforms) approves → APPROVED → send engine. */
export async function approveProposal(orgId: string, id: string, userId: string | null, opts: { byAutomation?: boolean } = {}) {
  const p = await prisma.proposal.findFirstOrThrow({ where: { id, organizationId: orgId } });
  if (!["WAITING_APPROVAL", "AI_REVIEWED", "DRAFT", "FAILED"].includes(p.status)) throw new ApiError(`Proposal is ${p.status}; cannot approve`, 409);
  const compliance = p.complianceResult as { allowed?: boolean; issues?: { severity: string; message: string }[] };
  if (compliance?.allowed === false && opts.byAutomation) throw new ApiError("Compliance blocked this proposal; a human must review", 409);
  await prisma.proposal.update({ where: { id }, data: { status: "APPROVED", approvedByUserId: userId, approvedAt: new Date() } });
  await logAudit({ orgId, actorType: opts.byAutomation ? "AI" : "USER", userId, actorId: userId ?? "automation", agent: opts.byAutomation ? "automation" : null, action: "proposal.approved", entityType: "proposal", entityId: id, before: { status: p.status }, after: { status: "APPROVED" } });
  await dispatch(orgId, { type: "PROPOSAL_APPROVED", proposalId: id, actorUserId: userId });
  return prisma.proposal.findUniqueOrThrow({ where: { id } });
}

export async function rejectProposal(orgId: string, id: string, userId: string, reason: string) {
  const p = await prisma.proposal.findFirstOrThrow({ where: { id, organizationId: orgId } });
  if (["SENT", "REPLIED"].includes(p.status)) throw new ApiError("Cannot reject a sent proposal", 409);
  await prisma.$transaction([
    prisma.proposal.update({ where: { id }, data: { status: "CLOSED", failedReason: reason } }),
    prisma.opportunity.update({ where: { id: p.opportunityId }, data: { status: "LOST", lostReason: reason, stageChangedAt: new Date() } }),
  ]);
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "proposal.rejected", entityType: "proposal", entityId: id, before: { status: p.status }, after: { status: "CLOSED" }, reason });
}

/** Human edit → new version (keeps the AI original in history). */
export async function editProposal(orgId: string, id: string, userId: string, input: { proposalTranslated: string; proposalOriginal?: string; changeReason?: string }) {
  const p = await prisma.proposal.findFirstOrThrow({ where: { id, organizationId: orgId } });
  if (["SENT", "REPLIED", "CLOSED"].includes(p.status)) throw new ApiError("Cannot edit a sent proposal", 409);
  const version = (await prisma.proposalVersion.count({ where: { proposalId: id } })) + 1;
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.proposal.update({ where: { id }, data: { proposalTranslated: input.proposalTranslated, proposalOriginal: input.proposalOriginal ?? p.proposalOriginal, status: p.status === "APPROVED" ? "WAITING_APPROVAL" : p.status } });
    await tx.proposalVersion.create({ data: { organizationId: orgId, proposalId: id, version, proposalOriginal: u.proposalOriginal, proposalTranslated: u.proposalTranslated, structured: p.structured as Prisma.InputJsonValue, length: p.length, tone: p.tone, changeReason: input.changeReason ?? "human edit", authorType: "HUMAN" } });
    return u;
  });
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "proposal.edited", entityType: "proposal", entityId: id, after: { version } });
  return updated;
}

/** MANUAL_ONLY platforms: human copies the text into the marketplace UI and marks it sent here. */
export async function markProposalSentManually(orgId: string, id: string, userId: string, externalProposalId?: string) {
  const p = await prisma.proposal.findFirstOrThrow({ where: { id, organizationId: orgId }, include: { opportunity: true } });
  if (["SENT", "REPLIED", "CLOSED"].includes(p.status)) throw new ApiError("Already sent", 409);
  const { finalizeSent } = await import("../sending/send-engine");
  await finalizeSent(orgId, p.id, { externalProposalId: externalProposalId ?? null, externalThreadId: null, actorType: "USER", actorId: userId });
  return prisma.proposal.findUniqueOrThrow({ where: { id } });
}
