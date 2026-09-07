import type { PlatformConnector, ConnectorContext, DiscoverParams, NormalizedJob, SendProposalInput, SendResult, InboundMessage } from "../types";
import { generateDemoJobs } from "../../demo/jobs";
import { simulateClientReply } from "../../demo/client-simulator";
import { prisma } from "../../db";
import { getOrgSettings } from "../../settings";
import { fromUsd } from "../../currency";
import { dec } from "../../utils";

/**
 * Demo Marketplace connector — Fake Marketplace API.
 * Discovery: 100 deterministic fictional jobs (also exposed at /api/demo/marketplace/jobs).
 * Sending: always succeeds and opens a thread.
 * Replies: the fake client answers according to the job's scripted persona each time we send a message.
 */
export const demoMarketplaceConnector: PlatformConnector = {
  key: "demo-marketplace",
  displayName: "Demo Marketplace (Fake API)",
  website: "https://demo-marketplace.local",
  capabilities: { discover: true, sendProposal: true, fetchReplies: true, webhook: true },
  compliance: { officialApi: true, automatedSendingPolicy: "ALLOWED", defaultSendMode: "MANUAL_APPROVAL", notes: "Fictional marketplace for demos and E2E tests. No external calls." },
  supportedLanguages: ["ja", "en", "de", "fr", "es", "ko"],
  credentialFields: [{ key: "apiKey", label: "API Key (any value)", secret: true }],

  async discover(_ctx: ConnectorContext, params: DiscoverParams): Promise<NormalizedJob[]> {
    let jobs = generateDemoJobs(100);
    if (params.categories?.length) jobs = jobs.filter((j) => params.categories!.includes(j.category ?? ""));
    if (params.keywords?.length) {
      // Priority keywords rank matching jobs first (they do not exclude jobs on the demo marketplace)
      const kws = params.keywords.map((k) => k.toLowerCase());
      const hit = (j: NormalizedJob) => kws.some((k) => j.raw_text.toLowerCase().includes(k));
      jobs = [...jobs.filter(hit), ...jobs.filter((j) => !hit(j))];
    }
    return jobs.slice(0, params.limit ?? 100);
  },

  async sendProposal(_ctx, input: SendProposalInput): Promise<SendResult> {
    return { ok: true, externalProposalId: `DEMO-PROP-${input.reference.slice(-8)}`, externalThreadId: `DEMO-THREAD-${input.jobExternalId}` };
  },

  /**
   * Generates the next scripted client reply for every demo conversation where our side spoke last.
   */
  async fetchReplies(ctx, _since): Promise<InboundMessage[]> {
    const { settings } = await getOrgSettings(ctx.orgId);
    const convs = await prisma.conversation.findMany({
      where: { organizationId: ctx.orgId, platformKey: "demo-marketplace" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        opportunity: { include: { job: true, proposal: true } },
      },
    });
    const out: InboundMessage[] = [];
    for (const c of convs) {
      const last = c.messages.at(-1);
      if (!last || last.direction !== "OUTBOUND" || !last.sentAt) continue;
      if (["WON", "LOST"].includes(c.opportunity.status)) continue;
      const inboundCount = c.messages.filter((m) => m.direction === "INBOUND").length;
      const meta = (c.opportunity.job.sourceMetadata ?? {}) as { persona?: string[] };
      const persona = meta.persona ?? ["INTERESTED", "ACCEPTANCE"];
      const currency = c.opportunity.job.currency;
      const proposal = c.opportunity.proposal;
      const pricingState = (c.pricingState ?? {}) as { currentOfferUsd?: number };
      const currentUsd = pricingState.currentOfferUsd ?? dec(proposal?.proposedPriceUsd);
      const sim = simulateClientReply({
        persona,
        round: inboundCount,
        language: c.clientLanguage,
        proposedPrice: currentUsd ? fromUsd(currentUsd, currency) : dec(proposal?.proposedPrice),
        currency,
        minimumPriceLocal: fromUsd(settings.pricing.minimumPrice, currency),
        jobId: c.opportunity.job.externalJobId,
        category: c.opportunity.job.category,
      });
      if (!sim) continue;
      out.push({
        externalThreadId: c.externalThreadId ?? `DEMO-THREAD-${c.opportunity.job.externalJobId}`,
        externalMessageId: `DEMO-MSG-${c.id}-${inboundCount + 1}`,
        jobExternalId: c.opportunity.job.externalJobId,
        text: sim.text,
        receivedAt: new Date().toISOString(),
        clientName: c.opportunity.job.clientName ?? undefined,
        hint: sim.category,
      });
    }
    return out;
  },

  verifyWebhook(_rawBody, headers, secret) {
    return headers["x-demo-secret"] === secret;
  },

  async testConnection() {
    return { ok: true, message: "Demo marketplace ready (100 fictional jobs)" };
  },
};
