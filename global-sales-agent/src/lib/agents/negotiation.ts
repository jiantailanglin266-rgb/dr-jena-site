import { prisma } from "../db";
import { runJson } from "../ai/provider";
import { negotiationSchema, type NegotiationOutput, type ReplyAnalysisOutput } from "./schemas";
import { getPrompt, renderPrompt } from "./prompts";
import { profileForPrompt, type AgentContext } from "./context";
import { buildThreadContext, renderThread } from "./thread";
import { evaluateOffer, enforceFloor, PricingViolation } from "../pricing/engine";
import { toUsd, fromUsd } from "../currency";
import { logAudit } from "../audit";
import type { Quote } from "@prisma/client";

/**
 * Negotiation Agent: Pricing Engine decides the allowed strategies & floor; the AI writes the message.
 * Produces a Quote (DRAFT / WAITING_APPROVAL) and returns the strategy + body for the Reply Agent.
 */
export async function runNegotiationAgent(ctx: AgentContext, conversationId: string): Promise<{ output: NegotiationOutput; quote: Quote; requiresHumanApproval: boolean }> {
  const thread = await buildThreadContext(ctx.orgId, conversationId);
  const lastInbound = [...thread.messages].reverse().find((m) => m.direction === "INBOUND");
  const analysis = (lastInbound?.analysis ?? {}) as Partial<ReplyAnalysisOutput>;
  const cfg = ctx.settings.pricing;
  const currency = thread.job.currency;

  const requestedLocal = analysis.extracted?.proposed_price ?? null;
  const requestedUsd = requestedLocal !== null ? toUsd(requestedLocal, analysis.extracted?.currency ?? currency) : null;
  const evaluation = evaluateOffer({
    currentOffer: thread.pricingState.currentOfferUsd || cfg.targetPrice,
    requestedPrice: requestedUsd,
    discountAlreadyAppliedPct: thread.pricingState.discountAppliedPct,
    cfg,
    roundsSoFar: thread.pricingState.rounds,
    requireHumanApprovalForPrice: ctx.settings.requireHumanApprovalForPrice,
  });
  const deliverables = thread.analysis?.deliverables ?? [];
  const scopeCandidates = deliverables.slice(Math.max(1, Math.ceil(deliverables.length / 2)));
  const prompt = await getPrompt(ctx.orgId, "negotiation");
  const { data, aiRunId } = await runJson(
    ctx.ai,
    negotiationSchema,
    {
      agent: "negotiation",
      purpose: "negotiate",
      system: prompt.system,
      messages: [{ role: "user", content: renderPrompt(prompt.user, { thread: renderThread(thread), evaluation: { ...evaluation, offerPriceLocal: fromUsd(evaluation.offerPrice, currency), currency }, company: profileForPrompt(ctx.profile) }) }],
      context: {
        language: thread.clientLanguage, strategy: evaluation.recommended, offerPrice: fromUsd(evaluation.offerPrice, currency), currency, discountPct: evaluation.discountPct,
        targetPrice: requestedLocal, hours: thread.analysis?.hours ?? 0, scope: scopeCandidates, revisions: 2,
      },
      maxTokens: 2000,
    },
    { entityType: "conversation", entityId: conversationId },
  );

  // Hard validation: strategy allowed? price >= floor? (AI can never undercut the floor)
  const strategy = evaluation.allowedStrategies.includes(data.strategy) ? data.strategy : evaluation.recommended;
  let offerUsd = toUsd(data.offer_price, data.currency || currency) ?? evaluation.offerPrice;
  try {
    offerUsd = enforceFloor(offerUsd, cfg, true);
  } catch (e) {
    if (e instanceof PricingViolation) offerUsd = evaluation.offerPrice; // replace with engine's safe offer
    else throw e;
  }
  if (strategy === "DECLINE") offerUsd = cfg.minimumPrice;
  const offerLocal = fromUsd(offerUsd, currency);
  const discountPct = Math.max(0, Math.round((1 - offerUsd / Math.max(evaluation.currentOffer, 1)) * 1000) / 10);
  const requiresHumanApproval = evaluation.requiresHumanApproval;

  const version = (await prisma.quote.count({ where: { opportunityId: thread.opportunityId } })) + 1;
  const quote = await prisma.$transaction(async (tx) => {
    await tx.quote.updateMany({ where: { opportunityId: thread.opportunityId, status: { in: ["DRAFT", "WAITING_APPROVAL"] } }, data: { status: "SUPERSEDED" } });
    const q = await tx.quote.create({
      data: {
        organizationId: ctx.orgId, opportunityId: thread.opportunityId, version, status: requiresHumanApproval ? "WAITING_APPROVAL" : "DRAFT", currency, totalAmount: offerLocal, totalAmountUsd: offerUsd,
        discountPct, lineItems: [{ description: `${thread.job.title} (${strategy})`, amount: offerLocal }, ...(strategy === "ADD_OPTION" ? [{ description: "Included option: 30-day post-launch support", amount: 0 }] : [])] as object,
        deliveryDays: thread.proposal?.deliveryDays ?? null, revisionRounds: 2, paymentTerms: strategy === "SPLIT_DELIVERY" ? "Phase-based: 50% per phase" : "50% upfront, 50% on delivery",
        notes: data.rationale, requiresHumanApproval,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { pricingState: { currentOfferUsd: offerUsd, discountAppliedPct: thread.pricingState.discountAppliedPct + discountPct, rounds: thread.pricingState.rounds + 1, scopeAdjustments: [...thread.pricingState.scopeAdjustments, ...(strategy === "SCOPE_REDUCTION" ? scopeCandidates : [])] } as object },
    });
    await tx.opportunity.update({ where: { id: thread.opportunityId }, data: { status: "NEGOTIATING", stageChangedAt: new Date() } });
    await tx.activity.create({ data: { organizationId: ctx.orgId, opportunityId: thread.opportunityId, type: "QUOTE_CREATED", title: `Negotiation: ${strategy} → ${offerLocal} ${currency}${requiresHumanApproval ? " (needs approval)" : ""}`, actorType: "AI", actorId: "negotiation-agent" } });
    return q;
  });
  await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "negotiation", action: "quote.created", entityType: "quote", entityId: quote.id, after: { strategy, offerUsd, discountPct, floor: cfg.minimumPrice, requestedUsd, requiresHumanApproval, aiRunId, notes: evaluation.notes } });
  return { output: { ...data, strategy, offer_price: offerLocal, currency, discount_pct: discountPct }, quote, requiresHumanApproval };
}
