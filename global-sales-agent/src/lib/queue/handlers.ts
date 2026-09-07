import type { ProposalOptions } from "../agents/proposal";

export interface TaskPayloads {
  discovery: { orgId: string; platformKey?: string; limit?: number };
  analyze_job: { orgId: string; jobId: string };
  create_proposal: { orgId: string; jobId: string; options?: ProposalOptions };
  send_proposal: { orgId: string; proposalId: string; actorUserId?: string | null };
  poll_replies: { orgId: string; platformKey?: string };
  process_inbound: { orgId: string; messageId: string; hint?: string | null };
  generate_reply: { orgId: string; conversationId: string; instruction?: string };
  negotiate_reply: { orgId: string; conversationId: string };
  deal_summary: { orgId: string; opportunityId: string };
  send_message: { orgId: string; messageId: string; actorUserId?: string | null };
}
export type TaskName = keyof TaskPayloads;

/** Executes a task by name (used by both BullMQ worker and the inline queue). */
export async function runTask<N extends TaskName>(name: N, payload: TaskPayloads[N]): Promise<unknown> {
  switch (name) {
    case "discovery": {
      const { runDiscovery } = await import("../services/discovery");
      const p = payload as TaskPayloads["discovery"];
      return runDiscovery(p.orgId, { platformKey: p.platformKey, limit: p.limit });
    }
    case "analyze_job": {
      const { analyzeJob } = await import("../services/jobs");
      const p = payload as TaskPayloads["analyze_job"];
      return analyzeJob(p.orgId, p.jobId);
    }
    case "create_proposal": {
      const { createProposal } = await import("../services/proposals");
      const p = payload as TaskPayloads["create_proposal"];
      return createProposal(p.orgId, p.jobId, p.options ?? {});
    }
    case "send_proposal": {
      const { sendProposal } = await import("../sending/send-engine");
      const p = payload as TaskPayloads["send_proposal"];
      return sendProposal(p.orgId, p.proposalId, p.actorUserId ?? null);
    }
    case "poll_replies": {
      const { pollReplies } = await import("../services/conversations");
      const p = payload as TaskPayloads["poll_replies"];
      return pollReplies(p.orgId, p.platformKey);
    }
    case "process_inbound": {
      const { processInboundMessage } = await import("../services/conversations");
      const p = payload as TaskPayloads["process_inbound"];
      return processInboundMessage(p.orgId, p.messageId, p.hint ?? null);
    }
    case "generate_reply": {
      const { draftReply } = await import("../services/conversations");
      const p = payload as TaskPayloads["generate_reply"];
      return draftReply(p.orgId, p.conversationId, { instruction: p.instruction });
    }
    case "negotiate_reply": {
      const { draftNegotiationReply } = await import("../services/conversations");
      const p = payload as TaskPayloads["negotiate_reply"];
      return draftNegotiationReply(p.orgId, p.conversationId);
    }
    case "deal_summary": {
      const { createDealSummary } = await import("../services/deals");
      const p = payload as TaskPayloads["deal_summary"];
      return createDealSummary(p.orgId, p.opportunityId);
    }
    case "send_message": {
      const { sendMessage } = await import("../services/conversations");
      const p = payload as TaskPayloads["send_message"];
      return sendMessage(p.orgId, p.messageId, p.actorUserId ?? null);
    }
    default:
      throw new Error(`Unknown task ${String(name)}`);
  }
}
