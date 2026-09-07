import { prisma } from "../db";
import { buildAgentContext } from "../agents/context";
import { analyzeInboundMessage, generateReplyDraft } from "../agents/reply";
import { runNegotiationAgent } from "../agents/negotiation";
import { dispatch } from "../agents/orchestrator";
import { getConnector } from "../connectors/registry";
import { decryptJson } from "../crypto";
import type { InboundMessage } from "../connectors/types";
import { logAudit } from "../audit";
import { markMemoryReplied } from "./memory";
import { ApiError } from "../errors";
import { detectLanguage } from "../language/detect";
import type { LeadStatus, Prisma } from "@prisma/client";

const CATEGORY_TO_STATUS: Record<string, LeadStatus | null> = {
  INTERESTED: "REPLIED", QUESTION: "REPLIED", TECHNICAL_QUESTION: "REPLIED", REQUEST_PORTFOLIO: "REPLIED", PRICE_NEGOTIATION: "NEGOTIATING", SCHEDULE_NEGOTIATION: "NEGOTIATING",
  REQUEST_MEETING: "MEETING_REQUESTED", OBJECTION: "NEGOTIATING", REJECTION: "LOST", ACCEPTANCE: "VERBAL_ACCEPT", UNKNOWN: "REPLIED",
};
const STATUS_RANK: LeadStatus[] = ["DISCOVERED", "QUALIFIED", "PROPOSAL_CREATED", "PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT", "WON", "LOST"];

/** Ingest an inbound message from a connector / webhook. Returns the created message id (or null when duplicate). */
export async function ingestInbound(orgId: string, platformKey: string, m: InboundMessage): Promise<string | null> {
  const dup = await prisma.message.findFirst({ where: { organizationId: orgId, externalMessageId: m.externalMessageId } });
  if (dup) return null;
  // Find the conversation by external thread or by job external id
  let conv = m.externalThreadId ? await prisma.conversation.findFirst({ where: { organizationId: orgId, platformKey, externalThreadId: m.externalThreadId } }) : null;
  if (!conv && m.jobExternalId) {
    const job = await prisma.job.findUnique({ where: { organizationId_platformKey_externalJobId: { organizationId: orgId, platformKey, externalJobId: m.jobExternalId } }, include: { opportunity: { include: { conversation: true } } } });
    conv = job?.opportunity?.conversation ?? null;
    if (!conv && job?.opportunity) {
      conv = await prisma.conversation.create({ data: { organizationId: orgId, opportunityId: job.opportunity.id, platformKey, externalThreadId: m.externalThreadId, clientLanguage: job.clientLanguage ?? detectLanguage(m.text) } });
    }
  }
  if (!conv) {
    await logAudit({ orgId, actorType: "SYSTEM", action: "inbound.unmatched", entityType: "message", reason: `thread ${m.externalThreadId} / job ${m.jobExternalId}` });
    return null;
  }
  const language = detectLanguage(m.text);
  const msg = await prisma.message.create({ data: { organizationId: orgId, conversationId: conv.id, direction: "INBOUND", authorType: "CLIENT", externalMessageId: m.externalMessageId, language, body: m.text, approvalStatus: "NOT_REQUIRED", createdAt: new Date(m.receivedAt) } });
  await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(), lastInboundAt: new Date(), externalThreadId: conv.externalThreadId ?? m.externalThreadId } });
  const opp = await prisma.opportunity.findUnique({ where: { id: conv.opportunityId }, include: { proposal: true } });
  if (opp?.proposal && opp.proposal.status === "SENT") {
    await prisma.proposal.update({ where: { id: opp.proposal.id }, data: { status: "REPLIED" } });
    await markMemoryReplied(opp.proposal.id);
  }
  await prisma.activity.create({ data: { organizationId: orgId, opportunityId: conv.opportunityId, type: "REPLY_RECEIVED", title: `Client replied (${language})`, detail: m.text.slice(0, 200), actorType: "SYSTEM" } });
  await dispatch(orgId, { type: "REPLY_RECEIVED", messageId: msg.id, hint: m.hint ?? null });
  return msg.id;
}

/** Reply Intelligence on an inbound message → status transition → REPLY_ANALYZED event. */
export async function processInboundMessage(orgId: string, messageId: string, hint: string | null) {
  const ctx = await buildAgentContext(orgId);
  const analysis = await analyzeInboundMessage(ctx, messageId, hint);
  const msg = await prisma.message.findUniqueOrThrow({ where: { id: messageId }, include: { conversation: true } });
  const opp = await prisma.opportunity.findUniqueOrThrow({ where: { id: msg.conversation.opportunityId } });
  const target = CATEGORY_TO_STATUS[analysis.category];
  if (target && opp.status !== "WON") {
    const forward = STATUS_RANK.indexOf(target) > STATUS_RANK.indexOf(opp.status) || target === "LOST";
    if (forward && !(target === "VERBAL_ACCEPT")) {
      await prisma.opportunity.update({ where: { id: opp.id }, data: { status: target, stageChangedAt: new Date(), ...(target === "LOST" ? { lostReason: "client_rejected" } : {}) } });
      await prisma.activity.create({ data: { organizationId: orgId, opportunityId: opp.id, type: "STAGE_CHANGED", title: `Stage → ${target} (${analysis.category})`, actorType: "AI", actorId: "reply-agent" } });
    }
  }
  await dispatch(orgId, { type: "REPLY_ANALYZED", messageId, conversationId: msg.conversationId, opportunityId: opp.id, category: analysis.category });
  return analysis;
}

export async function draftReply(orgId: string, conversationId: string, opts: { instruction?: string; negotiationBody?: string; dealSummaryLines?: string[] } = {}, actorUserId?: string | null) {
  const ctx = await buildAgentContext(orgId, actorUserId);
  const message = await generateReplyDraft(ctx, conversationId, opts);
  if (message.approvalStatus === "NOT_REQUIRED") await sendMessage(orgId, message.id, null);
  return message;
}

export async function draftNegotiationReply(orgId: string, conversationId: string, actorUserId?: string | null) {
  const ctx = await buildAgentContext(orgId, actorUserId);
  const neg = await runNegotiationAgent(ctx, conversationId);
  const message = await generateReplyDraft(ctx, conversationId, { negotiationBody: neg.output.body });
  if (neg.requiresHumanApproval && message.approvalStatus !== "PENDING") {
    await prisma.message.update({ where: { id: message.id }, data: { approvalStatus: "PENDING" } });
  }
  if (neg.requiresHumanApproval) {
    await prisma.task.create({ data: { organizationId: orgId, opportunityId: neg.quote.opportunityId, title: `Approve price: ${neg.output.offer_price} ${neg.output.currency} (${neg.output.strategy})`, description: neg.output.rationale } });
  } else if (message.approvalStatus === "NOT_REQUIRED") {
    await sendMessage(orgId, message.id, null);
  }
  return { message, negotiation: neg.output, quote: neg.quote };
}

/** Human approves (and edits) a drafted message → send through connector (or mark manually sent). */
export async function sendMessage(orgId: string, messageId: string, actorUserId: string | null, edit?: { body?: string }) {
  const msg = await prisma.message.findFirstOrThrow({ where: { id: messageId, organizationId: orgId }, include: { conversation: { include: { opportunity: { include: { job: true, quotes: { orderBy: { version: "desc" }, take: 1 } } } } } } });
  if (msg.direction !== "OUTBOUND") throw new ApiError("Only outbound messages can be sent", 400);
  if (msg.sentAt) return msg;
  const body = edit?.body?.trim() || msg.body;
  const connector = getConnector(msg.conversation.platformKey);
  const account = await prisma.platformAccount.findUnique({ where: { organizationId_platformKey: { organizationId: orgId, platformKey: msg.conversation.platformKey } } });
  let externalMessageId: string | null = null;
  if (connector.capabilities.sendProposal && connector.sendProposal && account?.sendMode !== "MANUAL_ONLY") {
    const cctx = { orgId, platformAccountId: account?.id ?? "", credentials: decryptJson<Record<string, string>>(account?.credentialsEncrypted) ?? {}, config: (account?.config ?? {}) as Record<string, unknown> };
    // Connectors expose messaging through sendProposal-compatible endpoint in this version; real APIs map to their messaging endpoint here.
    const r = await connector.sendProposal(cctx, { jobExternalId: msg.conversation.opportunity.job.externalJobId, text: body, price: null, currency: msg.conversation.opportunity.job.currency, deliveryDays: null, language: msg.language ?? "en", reference: msg.id });
    if (!r.ok) throw new ApiError(r.error ?? "send failed", 502);
    externalMessageId = r.externalProposalId ?? null;
  }
  const quote = msg.conversation.opportunity.quotes[0];
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.message.update({ where: { id: messageId }, data: { body, approvalStatus: "APPROVED", approvedByUserId: actorUserId, sentAt: new Date(), externalMessageId, authorType: actorUserId && edit?.body ? "HUMAN" : msg.authorType } });
    await tx.conversation.update({ where: { id: msg.conversationId }, data: { lastMessageAt: new Date() } });
    if (quote && ["DRAFT", "WAITING_APPROVAL"].includes(quote.status)) {
      await tx.quote.update({ where: { id: quote.id }, data: { status: "SENT", sentAt: new Date(), approvedByUserId: actorUserId, approvedAt: actorUserId ? new Date() : null } });
      await tx.opportunity.update({ where: { id: msg.conversation.opportunityId }, data: { status: "QUOTE_SENT", stageChangedAt: new Date() } });
    }
    await tx.activity.create({ data: { organizationId: orgId, opportunityId: msg.conversation.opportunityId, type: "MESSAGE_SENT", title: `Reply sent (${msg.language ?? "?"})${actorUserId ? " — approved by human" : " — auto"}`, actorType: actorUserId ? "USER" : "AI", actorId: actorUserId ?? "reply-agent" } });
    return u;
  });
  await logAudit({ orgId, actorType: actorUserId ? "USER" : "AI", userId: actorUserId, actorId: actorUserId ?? "reply-agent", agent: actorUserId ? null : "reply", action: "message.sent", entityType: "message", entityId: messageId, after: { language: msg.language, edited: Boolean(edit?.body), quoteId: quote?.id ?? null } });
  return updated;
}

export async function rejectMessage(orgId: string, messageId: string, userId: string, reason?: string) {
  const msg = await prisma.message.findFirstOrThrow({ where: { id: messageId, organizationId: orgId } });
  if (msg.sentAt) throw new ApiError("Already sent", 409);
  await prisma.message.update({ where: { id: messageId }, data: { approvalStatus: "REJECTED", approvedByUserId: userId } });
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "message.rejected", entityType: "message", entityId: messageId, reason });
}

/** Human writes a message directly */
export async function composeMessage(orgId: string, conversationId: string, userId: string, body: string, send = true) {
  const conv = await prisma.conversation.findFirstOrThrow({ where: { id: conversationId, organizationId: orgId } });
  const msg = await prisma.message.create({ data: { organizationId: orgId, conversationId: conv.id, direction: "OUTBOUND", authorType: "HUMAN", authorUserId: userId, language: conv.clientLanguage, body, approvalStatus: "APPROVED" } });
  if (send) return sendMessage(orgId, msg.id, userId);
  return msg;
}

/** Poll connectors for replies (worker / manual "Sync replies" button). */
export async function pollReplies(orgId: string, platformKey?: string) {
  const accounts = await prisma.platformAccount.findMany({ where: { organizationId: orgId, enabled: true, ...(platformKey ? { platformKey } : {}) } });
  const out: { platformKey: string; received: number; error?: string }[] = [];
  for (const account of accounts) {
    const connector = getConnector(account.platformKey);
    if (!connector.capabilities.fetchReplies || !connector.fetchReplies) continue;
    try {
      const msgs = await connector.fetchReplies({ orgId, platformAccountId: account.id, credentials: decryptJson<Record<string, string>>(account.credentialsEncrypted) ?? {}, config: (account.config ?? {}) as Record<string, unknown> }, account.lastReplyPollAt);
      let received = 0;
      for (const m of msgs) if (await ingestInbound(orgId, account.platformKey, m)) received += 1;
      await prisma.platformAccount.update({ where: { id: account.id }, data: { lastReplyPollAt: new Date() } });
      out.push({ platformKey: account.platformKey, received });
    } catch (err) {
      out.push({ platformKey: account.platformKey, received: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

export async function listConversations(orgId: string, f: { status?: LeadStatus; pendingOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, f.pageSize ?? 25);
  const where: Prisma.ConversationWhereInput = { organizationId: orgId, ...(f.status ? { opportunity: { status: f.status } } : {}), ...(f.pendingOnly ? { messages: { some: { approvalStatus: "PENDING" } } } : {}) };
  const [items, total] = await Promise.all([
    prisma.conversation.findMany({ where, include: { opportunity: { include: { job: { select: { projectTitle: true, clientName: true, clientCountry: true, category: true, platformKey: true } } } }, messages: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { messages: true } } }, orderBy: { lastMessageAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.conversation.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
