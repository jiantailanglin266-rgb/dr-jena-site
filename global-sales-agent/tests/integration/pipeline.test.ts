/**
 * Integration test: runs the whole pipeline against the real database (demo org, mock AI).
 * Requires DATABASE_URL + `npm run db:seed`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { analyzeJob } from "@/lib/services/jobs";
import { createProposal, approveProposal, editProposal } from "@/lib/services/proposals";
import { pollReplies, sendMessage, draftNegotiationReply, ingestInbound } from "@/lib/services/conversations";
import { approveDeal, createDealSummary } from "@/lib/services/deals";
import { checkSendLimits } from "@/lib/sending/limits";
import { getDashboardStats, getFunnel } from "@/lib/services/analytics";
import { getMemoryInsights } from "@/lib/services/memory";
import { dec } from "@/lib/utils";

let orgId = "";
let adminId = "";

async function resetOrgData() {
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { organizationId: orgId } }),
    prisma.quote.deleteMany({ where: { organizationId: orgId } }),
    prisma.deal.deleteMany({ where: { organizationId: orgId } }),
    prisma.conversation.deleteMany({ where: { organizationId: orgId } }),
    prisma.proposalVersion.deleteMany({ where: { organizationId: orgId } }),
    prisma.proposal.deleteMany({ where: { organizationId: orgId } }),
    prisma.performanceMemory.deleteMany({ where: { organizationId: orgId } }),
    prisma.task.deleteMany({ where: { organizationId: orgId } }),
    prisma.activity.deleteMany({ where: { organizationId: orgId } }),
    prisma.jobAnalysis.deleteMany({ where: { organizationId: orgId } }),
    prisma.opportunity.updateMany({ where: { organizationId: orgId }, data: { status: "DISCOVERED", lostReason: null } }),
    prisma.job.updateMany({ where: { organizationId: orgId }, data: { status: "NEW", excludedReason: null } }),
    prisma.client.updateMany({ where: { organizationId: orgId }, data: { totalWonValueUsd: 0 } }),
  ]);
}

function persona(job: { sourceMetadata: unknown }) {
  return ((job.sourceMetadata as { persona?: string[] }).persona ?? []).join(",");
}

describe("End-to-end pipeline (services, demo org, mock AI)", () => {
  beforeAll(async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@demo.local" } });
    orgId = org.id;
    adminId = admin.id;
    await resetOrgData();
  });

  it("analyses a job, generates a multilingual proposal, sends it, negotiates within the floor, and closes with human approval → CRM", async () => {
    const jobs = await prisma.job.findMany({ where: { organizationId: orgId, status: "NEW" } });
    const job = jobs.find((j) => persona(j) === "INTERESTED,PRICE_NEGOTIATION,ACCEPTANCE" && j.clientLanguage === "en") ?? jobs.find((j) => persona(j) === "INTERESTED,PRICE_NEGOTIATION,ACCEPTANCE")!;
    expect(job).toBeTruthy();

    // 1. Analysis
    const { analysis, qualified } = await analyzeJob(orgId, job.id);
    expect(analysis.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(analysis.fitScore).toBeGreaterThan(0);
    expect(qualified).toBe(true);
    const fresh = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(fresh.status).toBe("QUALIFIED");

    // 2. Proposal (Language Layer + Translation + Compliance)
    let proposal = await prisma.proposal.findUnique({ where: { jobId: job.id } });
    if (!proposal) proposal = await createProposal(orgId, job.id, { length: "STANDARD", tone: "CONSULTATIVE" }, adminId);
    expect(proposal.detectedLanguage).toBe(job.clientLanguage);
    expect(proposal.proposalTranslated.length).toBeGreaterThan(200);
    expect(proposal.proposalTranslated).toContain(job.projectTitle);
    if (job.clientLanguage !== "ja") expect(proposal.proposalOriginal).not.toBe(proposal.proposalTranslated);
    expect(dec(proposal.proposedPriceUsd)).toBeGreaterThanOrEqual(1000); // floor
    expect(["WAITING_APPROVAL", "APPROVED", "SENT"]).toContain(proposal.status);
    const versions = await prisma.proposalVersion.count({ where: { proposalId: proposal.id } });
    expect(versions).toBeGreaterThanOrEqual(1);

    // 3. Human edit → new version; approval → send engine → SENT + conversation opened
    if (proposal.status !== "SENT") {
      await editProposal(orgId, proposal.id, adminId, { proposalTranslated: proposal.proposalTranslated + "\n\nP.S. Happy to start with a short discovery call.", changeReason: "test edit" });
      proposal = await approveProposal(orgId, proposal.id, adminId);
    }
    proposal = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(proposal.status).toBe("SENT");
    expect(proposal.sentAt).toBeTruthy();
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { opportunityId: proposal.opportunityId } });
    expect(conv.clientLanguage).toBe(proposal.detectedLanguage);

    // Duplicate sending is impossible
    await expect(createProposal(orgId, job.id, { regenerate: true }, adminId)).rejects.toThrow();

    // 4. Client replies (INTERESTED) → Reply Intelligence → AI draft waiting approval
    await pollReplies(orgId, "demo-marketplace");
    let msgs = await prisma.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" } });
    const inbound1 = msgs.find((m) => m.direction === "INBOUND")!;
    expect(inbound1.replyCategory).toBe("INTERESTED");
    const a1 = inbound1.analysis as { purchase_probability: number; next_best_action: string; sentiment: string };
    expect(a1.purchase_probability).toBeGreaterThan(40);
    expect(a1.sentiment).toBe("POSITIVE");
    let draft = msgs.filter((m) => m.direction === "OUTBOUND" && !m.sentAt).at(-1)!;
    expect(draft.approvalStatus).toBe("PENDING");
    expect(draft.language).toBe(conv.clientLanguage);
    await sendMessage(orgId, draft.id, adminId);

    // 5. Client negotiates price → Negotiation Agent + Pricing Engine + quote needing approval
    await pollReplies(orgId, "demo-marketplace");
    msgs = await prisma.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" } });
    const inbound2 = msgs.filter((m) => m.direction === "INBOUND").at(-1)!;
    expect(inbound2.replyCategory).toBe("PRICE_NEGOTIATION");
    const quote = await prisma.quote.findFirst({ where: { opportunityId: proposal.opportunityId }, orderBy: { version: "desc" } });
    expect(quote).toBeTruthy();
    expect(dec(quote!.totalAmountUsd)).toBeGreaterThanOrEqual(1000);
    expect(dec(quote!.totalAmountUsd)).toBeLessThanOrEqual(dec(proposal.proposedPriceUsd));
    const opp = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposal.opportunityId } });
    expect(opp.status).toBe("NEGOTIATING");
    draft = msgs.filter((m) => m.direction === "OUTBOUND" && !m.sentAt).at(-1)!;
    expect(draft.approvalStatus).toBe("PENDING");
    await sendMessage(orgId, draft.id, adminId);
    const sentQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quote!.id } });
    expect(sentQuote.status).toBe("SENT");

    // 6. Client accepts → Closing Agent → deal summary waiting for HUMAN approval (AI never marks WON)
    await pollReplies(orgId, "demo-marketplace");
    const deal = await prisma.deal.findUniqueOrThrow({ where: { opportunityId: proposal.opportunityId } });
    expect(deal.status).toBe("WAITING_HUMAN_APPROVAL");
    const oppAfter = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposal.opportunityId } });
    expect(oppAfter.status).toBe("VERBAL_ACCEPT");
    const checklist = deal.checklist as { key: string; confirmed: boolean }[];
    expect(checklist).toHaveLength(9);
    await expect(approveDeal(orgId, deal.id, adminId)).rejects.toThrow(/unconfirmed/);

    // 7. Human confirms all items → WON → CRM
    const won = await approveDeal(orgId, deal.id, adminId, { checklist: checklist.map((c) => ({ key: c.key, confirmed: true, value: "confirmed" })) });
    expect(won.status).toBe("WON");
    const finalOpp = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposal.opportunityId }, include: { client: { include: { contacts: true } } } });
    expect(finalOpp.status).toBe("WON");
    expect(finalOpp.client?.contacts.length).toBeGreaterThan(0);
    expect(dec(finalOpp.client?.totalWonValueUsd)).toBeGreaterThan(0);
    const kickoff = await prisma.task.findFirst({ where: { opportunityId: proposal.opportunityId, title: { startsWith: "Kick-off" } } });
    expect(kickoff).toBeTruthy();

    // 8. Audit trail + AI runs + performance memory + analytics
    const audit = await prisma.auditLog.findMany({ where: { organizationId: orgId, entityId: { in: [job.id, proposal.id, deal.id] } } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["job.qualified", "proposal.generated", "proposal.approved", "proposal.sent", "deal.won"]));
    const runs = await prisma.aiRun.groupBy({ by: ["agent"], where: { organizationId: orgId }, _count: true });
    expect(runs.map((r) => r.agent)).toEqual(expect.arrayContaining(["analyst", "proposal", "compliance", "reply", "negotiation", "closing"]));
    const memory = await prisma.performanceMemory.findUniqueOrThrow({ where: { proposalId: proposal.id } });
    expect(memory.replied).toBe(true);
    expect(memory.won).toBe(true);
    const stats = await getDashboardStats(orgId);
    expect(stats.won).toBeGreaterThanOrEqual(1);
    expect((await getFunnel(orgId)).at(-1)?.count).toBeGreaterThanOrEqual(1);
    expect((await getMemoryInsights(orgId)).sampleSize).toBeGreaterThanOrEqual(1);
  });

  it("rejects a client offer below minimumPrice (DECLINE) and never quotes under the floor", async () => {
    const jobs = await prisma.job.findMany({ where: { organizationId: orgId, status: "NEW" } });
    const job = jobs.find((j) => persona(j) === "PRICE_NEGOTIATION,PRICE_NEGOTIATION,REJECTION")!;
    await analyzeJob(orgId, job.id);
    let proposal = await prisma.proposal.findUnique({ where: { jobId: job.id } });
    if (!proposal) proposal = await createProposal(orgId, job.id, {}, adminId);
    if (proposal.status !== "SENT") await approveProposal(orgId, proposal.id, adminId);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { opportunityId: proposal.opportunityId } });
    // round 1: 82% ask → discount/scope within limits
    await pollReplies(orgId, "demo-marketplace");
    let draft = (await prisma.message.findMany({ where: { conversationId: conv.id, direction: "OUTBOUND", sentAt: null } })).at(-1)!;
    await sendMessage(orgId, draft.id, adminId);
    // round 2: 45% ask → below floor → DECLINE strategy, offer == floor
    await pollReplies(orgId, "demo-marketplace");
    const quotes = await prisma.quote.findMany({ where: { opportunityId: proposal.opportunityId }, orderBy: { version: "asc" } });
    expect(quotes.length).toBeGreaterThanOrEqual(2);
    for (const q of quotes) expect(dec(q.totalAmountUsd)).toBeGreaterThanOrEqual(1000);
    const last = quotes.at(-1)!;
    expect(last.lineItems && JSON.stringify(last.lineItems)).toContain("DECLINE");
    draft = (await prisma.message.findMany({ where: { conversationId: conv.id, direction: "OUTBOUND", sentAt: null } })).at(-1)!;
    await sendMessage(orgId, draft.id, adminId);
    // round 3: rejection → LOST
    await pollReplies(orgId, "demo-marketplace");
    const opp = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposal.opportunityId } });
    expect(opp.status).toBe("LOST");
  });

  it("enforces send limits and handles webhook-style inbound ingestion idempotently", async () => {
    const limits = await checkSendLimits(orgId, "demo-marketplace", null);
    expect(limits.usage.dailyLimit).toBe(200);
    const tight = await prisma.platformLimit.update({ where: { organizationId_platformKey: { organizationId: orgId, platformKey: "demo-marketplace" } }, data: { hourlyLimit: 0 } });
    const blocked = await checkSendLimits(orgId, "demo-marketplace", null);
    expect(blocked.ok).toBe(false);
    expect(blocked.violations.map((v) => v.code)).toContain("HOURLY_LIMIT");
    await prisma.platformLimit.update({ where: { id: tight.id }, data: { hourlyLimit: 100 } });

    const sent = await prisma.proposal.findFirst({ where: { organizationId: orgId, status: { in: ["SENT", "REPLIED", "CLOSED"] } }, include: { job: true } });
    expect(sent).toBeTruthy();
    const msg = { externalThreadId: `DEMO-THREAD-${sent!.job.externalJobId}`, externalMessageId: "WEBHOOK-1", jobExternalId: sent!.job.externalJobId, text: "Could you share your portfolio?", receivedAt: new Date().toISOString() };
    const first = await ingestInbound(orgId, "demo-marketplace", msg);
    const second = await ingestInbound(orgId, "demo-marketplace", msg);
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    const stored = await prisma.message.findUnique({ where: { id: first! } });
    expect(stored?.replyCategory).toBe("REQUEST_PORTFOLIO");
  });

  it("negotiation agent requires human approval for price changes when configured", async () => {
    const conv = await prisma.conversation.findFirst({ where: { organizationId: orgId, opportunity: { status: { notIn: ["WON", "LOST"] } } } });
    if (!conv) return;
    const r = await draftNegotiationReply(orgId, conv.id, adminId);
    expect(dec(r.quote.totalAmountUsd)).toBeGreaterThanOrEqual(1000);
    if (r.quote.requiresHumanApproval) expect(r.message.approvalStatus).toBe("PENDING");
  });

  it("closing agent can be invoked manually and never sets WON by itself", async () => {
    const opp = await prisma.opportunity.findFirst({ where: { organizationId: orgId, conversation: { isNot: null }, status: { notIn: ["WON", "LOST"] } } });
    if (!opp) return;
    const { deal } = await createDealSummary(orgId, opp.id, adminId);
    expect(["SUMMARY_DRAFT", "WAITING_HUMAN_APPROVAL"]).toContain(deal.status);
  });
});
