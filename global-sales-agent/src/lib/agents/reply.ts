import { prisma } from "../db";
import { runJson } from "../ai/provider";
import { replyAnalysisSchema, replyDraftSchema, type ReplyAnalysisOutput } from "./schemas";
import { getPrompt, renderPrompt } from "./prompts";
import { profileForPrompt, type AgentContext } from "./context";
import { buildThreadContext, renderThread } from "./thread";
import { runTranslationAgent } from "./translation";
import { logAudit } from "../audit";
import { dec } from "../utils";
import { fromUsd } from "../currency";
import type { Message } from "@prisma/client";

/** Reply Intelligence: classify an inbound message using the full thread. */
export async function analyzeInboundMessage(ctx: AgentContext, messageId: string, hint?: string | null): Promise<ReplyAnalysisOutput> {
  const msg = await prisma.message.findFirstOrThrow({ where: { id: messageId, organizationId: ctx.orgId } });
  const thread = await buildThreadContext(ctx.orgId, msg.conversationId);
  const prompt = await getPrompt(ctx.orgId, "reply");
  const profile = profileForPrompt(ctx.profile);
  const { data, aiRunId } = await runJson(
    ctx.ai,
    replyAnalysisSchema,
    {
      agent: "reply",
      purpose: "analyze_reply",
      system: prompt.system,
      messages: [{ role: "user", content: renderPrompt(prompt.user, { thread: renderThread(thread), company: profile, task: "analyze_reply — classify the LAST client message", extra: `Last client message:\n<<client_message>>${msg.body}<</client_message>>` }) }],
      context: { message: msg.body, proposedPriceUsd: thread.proposal?.priceUsd ?? null, currency: thread.job.currency, hint: hint ?? null },
      maxTokens: 1500,
    },
    { entityType: "message", entityId: msg.id },
  );
  let bodyTranslated: string | null = null;
  const orgLang = ctx.settings.defaultLanguage;
  if ((msg.language ?? data.detected_language) !== orgLang) {
    const t = await runTranslationAgent(ctx, { text: msg.body, targetLanguage: orgLang, sourceLanguage: msg.language ?? data.detected_language, entityType: "message", entityId: msg.id });
    bodyTranslated = t.translated;
  }
  await prisma.message.update({ where: { id: msg.id }, data: { replyCategory: data.category, analysis: data as object, bodyTranslated, aiRunId, language: msg.language ?? data.detected_language } });
  await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "reply", action: "message.analyzed", entityType: "message", entityId: msg.id, after: { category: data.category, sentiment: data.sentiment, purchaseProbability: data.purchase_probability, nextBestAction: data.next_best_action } });
  return data;
}

export interface ReplyDraftOptions {
  /** Pre-computed negotiation body (from Negotiation Agent) to embed for PRICE_NEGOTIATION */
  negotiationBody?: string;
  dealSummaryLines?: string[];
  instruction?: string;
}

/** Generate the next outbound reply grounded in Thread Memory. Creates an OUTBOUND draft message (not sent). */
export async function generateReplyDraft(ctx: AgentContext, conversationId: string, opts: ReplyDraftOptions = {}): Promise<Message> {
  const thread = await buildThreadContext(ctx.orgId, conversationId);
  const lastInbound = [...thread.messages].reverse().find((m) => m.direction === "INBOUND");
  const analysis = (lastInbound?.analysis ?? {}) as Partial<ReplyAnalysisOutput>;
  const category = analysis.category ?? lastInbound?.category ?? "UNKNOWN";
  const profile = profileForPrompt(ctx.profile);
  const prompt = await getPrompt(ctx.orgId, "reply");
  const language = thread.clientLanguage;
  const currency = thread.job.currency;
  const offerLocal = thread.pricingState.currentOfferUsd ? fromUsd(thread.pricingState.currentOfferUsd, currency) : thread.proposal?.price ?? null;

  const { data, aiRunId } = await runJson(
    ctx.ai,
    replyDraftSchema,
    {
      agent: "reply",
      purpose: "generate_reply",
      system: prompt.system,
      messages: [{ role: "user", content: renderPrompt(prompt.user, { thread: renderThread(thread), company: profile, task: `generate_reply in ${language}`, extra: [opts.instruction, opts.negotiationBody ? `Use this pricing position verbatim in the reply:\n${opts.negotiationBody}` : "", opts.dealSummaryLines?.length ? `Agreed terms:\n${opts.dealSummaryLines.join("\n")}` : ""].filter(Boolean).join("\n\n") }) }],
      context: {
        category, language, clientName: thread.clientName || "there", company: ctx.profile.companyName, skills: thread.job.requiredSkills, portfolio: profile.portfolio, faq: profile.faq,
        questions: analysis.extracted?.questions ?? [], proposedPrice: offerLocal, currency, deadline: thread.job.deadline?.slice(0, 10) ?? null, dealSummaryLines: opts.dealSummaryLines ?? [], negotiationBody: opts.negotiationBody,
      },
      maxTokens: 3000,
    },
    { entityType: "conversation", entityId: conversationId },
  );
  let bodyTranslated: string | null = null;
  if (language !== ctx.settings.defaultLanguage) {
    const t = await runTranslationAgent(ctx, { text: data.body, targetLanguage: ctx.settings.defaultLanguage, sourceLanguage: language, entityType: "conversation", entityId: conversationId });
    bodyTranslated = t.translated;
  }
  const requiresApproval = !(ctx.settings.automationLevel === "FULL_AUTO" && !(category === "PRICE_NEGOTIATION" && ctx.settings.requireHumanApprovalForPrice) && category !== "ACCEPTANCE");
  const message = await prisma.message.create({
    data: {
      organizationId: ctx.orgId, conversationId, direction: "OUTBOUND", authorType: "AI", language, body: data.body, bodyTranslated,
      approvalStatus: requiresApproval ? "PENDING" : "NOT_REQUIRED", aiRunId, analysis: { includes: data.includes, suggestedNextStatus: data.suggested_next_status, inReplyToCategory: category } as object,
    },
  });
  await prisma.activity.create({ data: { organizationId: ctx.orgId, opportunityId: thread.opportunityId, type: "REPLY_DRAFTED", title: `AI reply drafted (${category})`, actorType: "AI", actorId: "reply-agent" } });
  await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "reply", action: "message.drafted", entityType: "message", entityId: message.id, after: { category, language, requiresApproval, includes: data.includes } });
  void dec;
  return message;
}
