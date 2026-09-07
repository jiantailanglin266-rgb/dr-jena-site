import { prisma } from "../db";
import { dec } from "../utils";

export interface DashboardStats {
  jobsDiscovered: number;
  jobsQualified: number;
  proposalsToday: number;
  proposalsSent: number;
  replies: number;
  replyRate: number;
  negotiations: number;
  meetings: number;
  won: number;
  winRate: number;
  pipelineValueUsd: number;
  confirmedRevenueUsd: number;
  avgDealSizeUsd: number;
  pendingApprovals: { proposals: number; messages: number; deals: number; quotes: number };
}

export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [jobsDiscovered, jobsQualified, proposalsToday, proposalsSent, repliedProposals, negotiations, meetings, wonDeals, pipeline, pendingProposals, pendingMessages, pendingDeals, pendingQuotes] = await Promise.all([
    prisma.job.count({ where: { organizationId: orgId } }),
    prisma.job.count({ where: { organizationId: orgId, status: "QUALIFIED" } }),
    prisma.proposal.count({ where: { organizationId: orgId, createdAt: { gte: todayStart } } }),
    prisma.proposal.count({ where: { organizationId: orgId, sentAt: { not: null } } }),
    prisma.conversation.count({ where: { organizationId: orgId, lastInboundAt: { not: null } } }),
    prisma.opportunity.count({ where: { organizationId: orgId, status: { in: ["NEGOTIATING", "QUOTE_SENT", "FINAL_NEGOTIATION"] } } }),
    prisma.opportunity.count({ where: { organizationId: orgId, status: "MEETING_REQUESTED" } }),
    prisma.deal.findMany({ where: { organizationId: orgId, status: "WON" }, select: { amountUsd: true } }),
    prisma.opportunity.aggregate({ where: { organizationId: orgId, status: { in: ["PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT"] } }, _sum: { estimatedValueUsd: true } }),
    prisma.proposal.count({ where: { organizationId: orgId, status: "WAITING_APPROVAL" } }),
    prisma.message.count({ where: { organizationId: orgId, approvalStatus: "PENDING" } }),
    prisma.deal.count({ where: { organizationId: orgId, status: "WAITING_HUMAN_APPROVAL" } }),
    prisma.quote.count({ where: { organizationId: orgId, status: "WAITING_APPROVAL" } }),
  ]);
  const won = wonDeals.length;
  const confirmedRevenueUsd = wonDeals.reduce((s, d) => s + dec(d.amountUsd), 0);
  return {
    jobsDiscovered, jobsQualified, proposalsToday, proposalsSent, replies: repliedProposals,
    replyRate: proposalsSent ? (repliedProposals / proposalsSent) * 100 : 0,
    negotiations, meetings, won,
    winRate: proposalsSent ? (won / proposalsSent) * 100 : 0,
    pipelineValueUsd: dec(pipeline._sum.estimatedValueUsd),
    confirmedRevenueUsd,
    avgDealSizeUsd: won ? confirmedRevenueUsd / won : 0,
    pendingApprovals: { proposals: pendingProposals, messages: pendingMessages, deals: pendingDeals, quotes: pendingQuotes },
  };
}

export interface FunnelStage { key: string; label: string; count: number; conversionFromPrev: number | null }

export async function getFunnel(orgId: string): Promise<FunnelStage[]> {
  const [discovered, qualified, sent, replied, negotiating, won] = await Promise.all([
    prisma.job.count({ where: { organizationId: orgId } }),
    // qualified = passed analysis OR a proposal exists (manual overrides count as qualified)
    prisma.job.count({ where: { organizationId: orgId, OR: [{ status: "QUALIFIED" }, { proposal: { isNot: null } }] } }),
    prisma.proposal.count({ where: { organizationId: orgId, sentAt: { not: null } } }),
    prisma.conversation.count({ where: { organizationId: orgId, lastInboundAt: { not: null } } }),
    prisma.opportunity.count({ where: { organizationId: orgId, status: { in: ["NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT", "WON"] } } }),
    prisma.opportunity.count({ where: { organizationId: orgId, status: "WON" } }),
  ]);
  const stages = [
    { key: "discovery", label: "Discovery", count: discovered },
    { key: "qualified", label: "Qualified", count: qualified },
    { key: "proposal_sent", label: "Proposal Sent", count: sent },
    { key: "reply", label: "Reply", count: replied },
    { key: "negotiation", label: "Negotiation", count: negotiating },
    { key: "won", label: "Won", count: won },
  ];
  return stages.map((s, i) => ({ ...s, conversionFromPrev: i === 0 ? null : stages[i - 1].count ? (s.count / stages[i - 1].count) * 100 : 0 }));
}

export interface BreakdownRow { key: string; jobs: number; proposals: number; replies: number; won: number; revenueUsd: number; replyRate: number; winRate: number }

async function breakdown(orgId: string, dim: "platformKey" | "clientCountry" | "clientLanguage" | "category"): Promise<BreakdownRow[]> {
  const opps = await prisma.opportunity.findMany({ where: { organizationId: orgId }, select: { status: true, job: { select: { platformKey: true, clientCountry: true, clientLanguage: true, category: true } }, proposal: { select: { sentAt: true } }, conversation: { select: { lastInboundAt: true } }, deal: { select: { status: true, amountUsd: true } } } });
  const map = new Map<string, BreakdownRow>();
  for (const o of opps) {
    const key = (o.job[dim] ?? "unknown") as string;
    const row = map.get(key) ?? { key, jobs: 0, proposals: 0, replies: 0, won: 0, revenueUsd: 0, replyRate: 0, winRate: 0 };
    row.jobs += 1;
    if (o.proposal?.sentAt) row.proposals += 1;
    if (o.conversation?.lastInboundAt) row.replies += 1;
    if (o.deal?.status === "WON") {
      row.won += 1;
      row.revenueUsd += dec(o.deal.amountUsd);
    }
    map.set(key, row);
  }
  return Array.from(map.values()).map((r) => ({ ...r, replyRate: r.proposals ? (r.replies / r.proposals) * 100 : 0, winRate: r.proposals ? (r.won / r.proposals) * 100 : 0 })).sort((a, b) => b.jobs - a.jobs);
}

export const byPlatform = (orgId: string) => breakdown(orgId, "platformKey");
export const byCountry = (orgId: string) => breakdown(orgId, "clientCountry");
export const byLanguage = (orgId: string) => breakdown(orgId, "clientLanguage");
export const byCategory = (orgId: string) => breakdown(orgId, "category");

export async function getDailySeries(orgId: string, days = 14) {
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const [jobs, proposals, replies, deals] = await Promise.all([
    prisma.job.findMany({ where: { organizationId: orgId, discoveredAt: { gte: start } }, select: { discoveredAt: true } }),
    prisma.proposal.findMany({ where: { organizationId: orgId, sentAt: { gte: start } }, select: { sentAt: true } }),
    prisma.message.findMany({ where: { organizationId: orgId, direction: "INBOUND", createdAt: { gte: start } }, select: { createdAt: true } }),
    prisma.deal.findMany({ where: { organizationId: orgId, wonAt: { gte: start } }, select: { wonAt: true } }),
  ]);
  const series: { date: string; discovered: number; sent: number; replies: number; won: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    series.push({
      date: key,
      discovered: jobs.filter((j) => j.discoveredAt.toISOString().slice(0, 10) === key).length,
      sent: proposals.filter((p) => p.sentAt && p.sentAt.toISOString().slice(0, 10) === key).length,
      replies: replies.filter((m) => m.createdAt.toISOString().slice(0, 10) === key).length,
      won: deals.filter((x) => x.wonAt && x.wonAt.toISOString().slice(0, 10) === key).length,
    });
  }
  return series;
}

export async function getAiCosts(orgId: string) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));
  const [day, month, total, byAgent, leads, proposals, replies, won, recent] = await Promise.all([
    prisma.aiRun.aggregate({ where: { organizationId: orgId, createdAt: { gte: dayStart } }, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
    prisma.aiRun.aggregate({ where: { organizationId: orgId, createdAt: { gte: monthStart } }, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
    prisma.aiRun.aggregate({ where: { organizationId: orgId }, _sum: { costUsd: true }, _count: true }),
    prisma.aiRun.groupBy({ by: ["agent"], where: { organizationId: orgId }, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
    prisma.job.count({ where: { organizationId: orgId, status: "QUALIFIED" } }),
    prisma.proposal.count({ where: { organizationId: orgId } }),
    prisma.message.count({ where: { organizationId: orgId, direction: "OUTBOUND", authorType: "AI" } }),
    prisma.deal.count({ where: { organizationId: orgId, status: "WON" } }),
    prisma.aiRun.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const totalCost = dec(total._sum.costUsd);
  return {
    dailyCostUsd: dec(day._sum.costUsd), dailyRuns: day._count, monthlyCostUsd: dec(month._sum.costUsd), monthlyRuns: month._count, totalCostUsd: totalCost, totalRuns: total._count,
    tokens: { dayIn: day._sum.inputTokens ?? 0, dayOut: day._sum.outputTokens ?? 0, monthIn: month._sum.inputTokens ?? 0, monthOut: month._sum.outputTokens ?? 0 },
    costPerLead: leads ? totalCost / leads : 0, costPerProposal: proposals ? totalCost / proposals : 0, costPerReply: replies ? totalCost / replies : 0, costPerWonDeal: won ? totalCost / won : 0,
    byAgent: byAgent.map((a) => ({ agent: a.agent, costUsd: dec(a._sum.costUsd), runs: a._count, inputTokens: a._sum.inputTokens ?? 0, outputTokens: a._sum.outputTokens ?? 0 })).sort((a, b) => b.costUsd - a.costUsd),
    recent,
  };
}

export async function getAbTestReport(orgId: string) {
  const rows = await prisma.performanceMemory.findMany({ where: { organizationId: orgId, sentAt: { not: null } } });
  const group = (key: keyof (typeof rows)[number]) => {
    const m = new Map<string, { n: number; replied: number; won: number }>();
    for (const r of rows) {
      const k = String(r[key]);
      const g = m.get(k) ?? { n: 0, replied: 0, won: 0 };
      g.n += 1;
      if (r.replied) g.replied += 1;
      if (r.won) g.won += 1;
      m.set(k, g);
    }
    return Array.from(m.entries()).map(([value, g]) => ({ value, n: g.n, replyRate: g.n ? (g.replied / g.n) * 100 : 0, winRate: g.n ? (g.won / g.n) * 100 : 0 })).sort((a, b) => b.n - a.n);
  };
  return { sampleSize: rows.length, variants: group("variantLabel"), openings: group("openingStyle"), lengths: group("length"), tones: group("tone"), ctas: group("ctaType"), pricePositions: group("pricePosition"), portfolio: group("hasPortfolio"), languages: group("language") };
}
