import { prisma } from "../db";
import { runJson } from "../ai/provider";
import { dealSummarySchema, type DealSummaryOutput } from "./schemas";
import { getPrompt, renderPrompt } from "./prompts";
import { type AgentContext } from "./context";
import { buildThreadContext, renderThread } from "./thread";
import { logAudit } from "../audit";
import { fromUsd, toUsd } from "../currency";
import type { Deal } from "@prisma/client";

export const DEAL_CHECKLIST = [
  { key: "price", label: "価格 / Price" },
  { key: "delivery", label: "納期 / Delivery" },
  { key: "scope", label: "業務内容 / Scope" },
  { key: "deliverables", label: "成果物 / Deliverables" },
  { key: "revision_rounds", label: "修正回数 / Revision rounds" },
  { key: "payment_terms", label: "支払い条件 / Payment terms" },
  { key: "ip_rights", label: "知的財産権 / IP rights" },
  { key: "maintenance", label: "保守 / Maintenance" },
  { key: "contract_method", label: "契約方法 / Contract method" },
] as const;

/** Closing Agent: builds a Deal Summary + checklist. Never marks WON — a human approves. */
export async function runClosingAgent(ctx: AgentContext, opportunityId: string): Promise<{ deal: Deal; summary: DealSummaryOutput }> {
  const opp = await prisma.opportunity.findFirstOrThrow({ where: { id: opportunityId, organizationId: ctx.orgId }, include: { conversation: true, job: true, proposal: true, quotes: { orderBy: { version: "desc" }, take: 1 }, client: true } });
  if (!opp.conversation) throw new Error("No conversation for opportunity");
  const thread = await buildThreadContext(ctx.orgId, opp.conversation.id);
  const quote = opp.quotes[0] ?? null;
  const currency = opp.job.currency;
  const agreedPriceLocal = quote ? Number(quote.totalAmount) : thread.pricingState.currentOfferUsd ? fromUsd(thread.pricingState.currentOfferUsd, currency) : opp.proposal ? Number(opp.proposal.proposedPrice) : null;
  const prompt = await getPrompt(ctx.orgId, "closing");
  const { data, aiRunId } = await runJson(
    ctx.ai,
    dealSummarySchema,
    {
      agent: "closing",
      purpose: "deal_summary",
      system: prompt.system,
      messages: [{ role: "user", content: renderPrompt(prompt.user, { thread: renderThread(thread), quote: thread.latestQuote }) }],
      context: {
        title: opp.job.projectTitle, language: ctx.settings.defaultLanguage, price: agreedPriceLocal, currency, deliveryDays: quote?.deliveryDays ?? opp.proposal?.proposedDeliveryDays ?? null,
        deliverables: thread.analysis?.deliverables ?? [], revisionRounds: quote?.revisionRounds ?? null, paymentTerms: quote?.paymentTerms ?? null,
        messages: thread.messages.map((m) => ({ direction: m.direction, body: m.body })),
      },
      maxTokens: 2500,
    },
    { entityType: "opportunity", entityId: opp.id },
  );
  const price = data.price ?? agreedPriceLocal ?? 0;
  const amountUsd = toUsd(price, data.currency || currency) ?? 0;
  const checklist = DEAL_CHECKLIST.map((c) => {
    const value = c.key === "deliverables" ? (data.deliverables.length ? data.deliverables.join(", ") : null) : c.key === "price" ? (price ? `${price} ${data.currency || currency}` : null) : (data[c.key as keyof DealSummaryOutput] as string | number | null);
    return { key: c.key, label: c.label, value: value ?? null, confirmed: value !== null && value !== undefined && !data.unresolved.includes(c.key) };
  });
  const status = ctx.settings.requireHumanApprovalForWon ? "WAITING_HUMAN_APPROVAL" : checklist.every((c) => c.confirmed) ? "WAITING_HUMAN_APPROVAL" : "SUMMARY_DRAFT";
  const deal = await prisma.$transaction(async (tx) => {
    const d = await tx.deal.upsert({
      where: { opportunityId: opp.id },
      create: { organizationId: ctx.orgId, opportunityId: opp.id, clientId: opp.clientId, status, title: opp.job.projectTitle, currency: data.currency || currency, amount: price, amountUsd, summary: { ...data, aiRunId } as object, checklist: checklist as object },
      update: { status, currency: data.currency || currency, amount: price, amountUsd, summary: { ...data, aiRunId } as object, checklist: checklist as object },
    });
    await tx.opportunity.update({ where: { id: opp.id }, data: { status: "VERBAL_ACCEPT", stageChangedAt: new Date() } });
    await tx.task.create({ data: { organizationId: ctx.orgId, opportunityId: opp.id, title: `Approve deal: ${opp.job.projectTitle}`, description: `Deal Summary ready (${checklist.filter((c) => c.confirmed).length}/${checklist.length} confirmed). Review and approve to mark WON.` } });
    await tx.activity.create({ data: { organizationId: ctx.orgId, opportunityId: opp.id, type: "DEAL_SUMMARY", title: `Deal summary created — ${checklist.filter((c) => c.confirmed).length}/${checklist.length} items confirmed`, actorType: "AI", actorId: "closing-agent" } });
    return d;
  });
  await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "closing", action: "deal.summary_created", entityType: "deal", entityId: deal.id, after: { status, amountUsd, unresolved: data.unresolved, confidence: data.confidence } });
  return { deal, summary: data };
}
