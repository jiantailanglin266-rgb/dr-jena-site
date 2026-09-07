import { prisma } from "../db";
import { dec } from "../utils";

/**
 * Thread Memory: everything the Reply / Negotiation / Closing agents must see —
 * job, analysis, proposal, quotes, pricing state and ALL messages of the conversation.
 */
export async function buildThreadContext(orgId: string, conversationId: string) {
  const c = await prisma.conversation.findFirstOrThrow({
    where: { id: conversationId, organizationId: orgId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      opportunity: { include: { job: { include: { analysis: true } }, proposal: true, quotes: { orderBy: { version: "desc" } }, client: true, deal: true } },
    },
  });
  const opp = c.opportunity;
  const proposal = opp.proposal;
  const quote = opp.quotes[0];
  const pricingState = (c.pricingState ?? {}) as { currentOfferUsd?: number; discountAppliedPct?: number; rounds?: number; scopeAdjustments?: string[] };
  return {
    conversationId: c.id,
    opportunityId: opp.id,
    status: opp.status,
    platformKey: c.platformKey,
    clientLanguage: c.clientLanguage,
    clientName: opp.job.clientName ?? opp.client?.name ?? "",
    job: {
      id: opp.job.id, title: opp.job.projectTitle, description: opp.job.projectDescription, category: opp.job.category, requiredSkills: opp.job.requiredSkills,
      budgetMin: opp.job.budgetMin ? dec(opp.job.budgetMin) : null, budgetMax: opp.job.budgetMax ? dec(opp.job.budgetMax) : null, currency: opp.job.currency, deadline: opp.job.deadline?.toISOString() ?? null,
      country: opp.job.clientCountry, externalJobId: opp.job.externalJobId,
    },
    analysis: opp.job.analysis ? { summary: opp.job.analysis.summary, deliverables: opp.job.analysis.requiredDeliverables, hours: opp.job.analysis.estimatedHours, marketPriceUsd: dec(opp.job.analysis.estimatedMarketPrice), riskFlags: opp.job.analysis.riskFlags } : null,
    proposal: proposal ? { id: proposal.id, text: proposal.proposalTranslated, priceUsd: dec(proposal.proposedPriceUsd), price: dec(proposal.proposedPrice), currency: proposal.currency, deliveryDays: proposal.proposedDeliveryDays, sentAt: proposal.sentAt?.toISOString() ?? null, language: proposal.detectedLanguage } : null,
    quotes: opp.quotes.map((q) => ({ id: q.id, version: q.version, status: q.status, total: dec(q.totalAmount), totalUsd: dec(q.totalAmountUsd), currency: q.currency, discountPct: dec(q.discountPct), deliveryDays: q.deliveryDays, paymentTerms: q.paymentTerms, revisionRounds: q.revisionRounds, lineItems: q.lineItems })),
    latestQuote: quote ? { id: quote.id, total: dec(quote.totalAmount), currency: quote.currency, deliveryDays: quote.deliveryDays, paymentTerms: quote.paymentTerms, revisionRounds: quote.revisionRounds, status: quote.status } : null,
    pricingState: { currentOfferUsd: pricingState.currentOfferUsd ?? (proposal ? dec(proposal.proposedPriceUsd) : 0), discountAppliedPct: pricingState.discountAppliedPct ?? 0, rounds: pricingState.rounds ?? 0, scopeAdjustments: pricingState.scopeAdjustments ?? [] },
    deal: opp.deal ? { id: opp.deal.id, status: opp.deal.status } : null,
    messages: c.messages.map((m) => ({ id: m.id, direction: m.direction, authorType: m.authorType, language: m.language, body: m.body, bodyTranslated: m.bodyTranslated, category: m.replyCategory, analysis: m.analysis, createdAt: m.createdAt.toISOString(), sentAt: m.sentAt?.toISOString() ?? null, approvalStatus: m.approvalStatus })),
    summary: c.summary,
  };
}

export type ThreadContext = Awaited<ReturnType<typeof buildThreadContext>>;

/** Render the thread as a prompt-safe transcript (client text wrapped as data). */
export function renderThread(t: ThreadContext): string {
  const lines: string[] = [];
  lines.push(`Job: ${t.job.title} [${t.job.category ?? "-"}] budget ${t.job.budgetMin ?? "?"}-${t.job.budgetMax ?? "?"} ${t.job.currency}; client ${t.clientName} (${t.job.country ?? "?"}, ${t.clientLanguage})`);
  if (t.analysis) lines.push(`Analysis: ${t.analysis.summary}\nDeliverables: ${t.analysis.deliverables.join(", ")}; est. ${t.analysis.hours}h; market ≈ USD ${t.analysis.marketPriceUsd}`);
  if (t.proposal) lines.push(`Our proposal (${t.proposal.language}, ${t.proposal.price} ${t.proposal.currency}, ${t.proposal.deliveryDays}d):\n${t.proposal.text}`);
  if (t.latestQuote) lines.push(`Latest quote v: ${t.latestQuote.total} ${t.latestQuote.currency}, ${t.latestQuote.deliveryDays}d, ${t.latestQuote.paymentTerms ?? "-"}, revisions ${t.latestQuote.revisionRounds ?? "-"} (${t.latestQuote.status})`);
  lines.push(`Pricing state: current offer USD ${t.pricingState.currentOfferUsd}, discount applied ${t.pricingState.discountAppliedPct}%, rounds ${t.pricingState.rounds}`);
  lines.push("Conversation:");
  for (const m of t.messages) {
    if (m.direction === "INBOUND") lines.push(`[CLIENT ${m.createdAt}] <<client_message>>${m.body}<</client_message>>`);
    else lines.push(`[US ${m.authorType} ${m.createdAt}${m.sentAt ? "" : " (unsent draft)"}] ${m.body}`);
  }
  return lines.join("\n");
}
