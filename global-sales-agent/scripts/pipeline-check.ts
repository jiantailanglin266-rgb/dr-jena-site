import "dotenv/config";
import { prisma } from "../src/lib/db";
import { analyzeJob } from "../src/lib/services/jobs";
import { createProposal, approveProposal } from "../src/lib/services/proposals";
import { pollReplies, sendMessage } from "../src/lib/services/conversations";
import { approveDeal } from "../src/lib/services/deals";

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@demo.local" } });
  // pick a Japanese job with persona INTERESTED→PRICE→ACCEPT
  const jobs = await prisma.job.findMany({ where: { organizationId: org.id, status: "NEW" }, take: 100 });
  const job = jobs.find((j) => ((j.sourceMetadata as { persona: string[] }).persona.join(",") === "INTERESTED,PRICE_NEGOTIATION,ACCEPTANCE") && j.clientLanguage === "de") ?? jobs[0];
  console.log("JOB", job.externalJobId, job.clientLanguage, job.projectTitle, (job.sourceMetadata as { persona: string[] }).persona);
  const a = await analyzeJob(org.id, job.id);
  console.log("ANALYSIS", { fit: a.analysis.fitScore, opp: a.analysis.opportunityScore, risk: a.analysis.riskScore, qualified: a.qualified, action: a.analysis.recommendedAction });
  let proposal = await prisma.proposal.findUnique({ where: { jobId: job.id } });
  if (!proposal) proposal = await createProposal(org.id, job.id, {}, admin.id);
  console.log("PROPOSAL", proposal.status, proposal.detectedLanguage, proposal.proposedPrice?.toString(), proposal.currency, "\n" + proposal.proposalTranslated.slice(0, 600));
  console.log("ORIGINAL(ja):", proposal.proposalOriginal.slice(0, 200));
  if (proposal.status === "WAITING_APPROVAL") proposal = await approveProposal(org.id, proposal.id, admin.id);
  proposal = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
  console.log("AFTER APPROVE", proposal.status, proposal.sentAt);
  for (let round = 0; round < 4; round++) {
    const polled = await pollReplies(org.id, "demo-marketplace");
    console.log("POLL", polled);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { opportunityId: proposal.opportunityId }, include: { messages: { orderBy: { createdAt: "asc" } }, opportunity: { include: { deal: true, quotes: true } } } });
    const last = conv.messages.at(-1)!;
    console.log(`ROUND ${round}: status=${conv.opportunity.status} msgs=${conv.messages.length} last=${last.direction}/${last.authorType}/${last.approvalStatus} cat=${conv.messages.filter(m=>m.direction==='INBOUND').at(-1)?.replyCategory}`);
    console.log("  LAST BODY:", last.body.slice(0, 300).replace(/\n/g, " | "));
    if (last.direction === "OUTBOUND" && !last.sentAt && last.approvalStatus === "PENDING") {
      await sendMessage(org.id, last.id, admin.id);
      console.log("  → human approved & sent");
    }
    if (conv.opportunity.deal) {
      console.log("DEAL", conv.opportunity.deal.status, conv.opportunity.deal.checklist);
      const d = await approveDeal(org.id, conv.opportunity.deal.id, admin.id, { checklist: (conv.opportunity.deal.checklist as { key: string }[]).map((c) => ({ key: c.key, confirmed: true, value: "confirmed" })) });
      console.log("WON", d.status, d.amountUsd.toString());
      break;
    }
  }
  const audit = await prisma.auditLog.count({ where: { organizationId: org.id } });
  const runs = await prisma.aiRun.groupBy({ by: ["agent"], _count: true, where: { organizationId: org.id } });
  console.log("AUDIT", audit, "AI RUNS", runs.map((r) => `${r.agent}:${r._count}`).join(", "));
  const client = await prisma.client.findFirst({ where: { organizationId: org.id, opportunities: { some: { jobId: job.id } } }, include: { contacts: true } });
  console.log("CRM", client?.name, client?.totalWonValueUsd.toString(), client?.contacts.length);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
