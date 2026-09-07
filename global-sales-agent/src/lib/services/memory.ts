import { prisma } from "../db";
import type { ProposalLength, ProposalTone } from "@prisma/client";

export interface MemoryInsights {
  sampleSize: number;
  replyRate: number;
  winRate: number;
  bestOpening?: string;
  bestCta?: string;
  bestTone?: string;
  bestLength?: string;
  bestPricePosition?: string;
  notes: string[];
}

function bestBy<T extends Record<string, unknown>>(rows: T[], key: keyof T, minN = 3): { value: string; rate: number; n: number } | undefined {
  const groups = new Map<string, { n: number; replied: number }>();
  for (const r of rows) {
    const k = String(r[key] ?? "");
    const g = groups.get(k) ?? { n: 0, replied: 0 };
    g.n += 1;
    if (r.replied) g.replied += 1;
    groups.set(k, g);
  }
  let best: { value: string; rate: number; n: number } | undefined;
  for (const [value, g] of groups) {
    if (g.n < minN) continue;
    const rate = g.replied / g.n;
    if (!best || rate > best.rate) best = { value, rate, n: g.n };
  }
  return best;
}

/** Aggregate what worked (reply / win rates by feature) — injected into the Proposal Agent prompt. */
export async function getMemoryInsights(orgId: string, filter?: { platformKey?: string; category?: string | null; country?: string | null; language?: string }): Promise<MemoryInsights> {
  const rows = await prisma.performanceMemory.findMany({
    where: { organizationId: orgId, sentAt: { not: null }, ...(filter?.platformKey ? { platformKey: filter.platformKey } : {}) },
    take: 500,
    orderBy: { sentAt: "desc" },
  });
  const scoped = rows.filter((r) => (!filter?.category || r.category === filter.category) && (!filter?.language || r.language === filter.language));
  const use = scoped.length >= 5 ? scoped : rows;
  const n = use.length;
  if (n === 0) return { sampleSize: 0, replyRate: 0, winRate: 0, notes: ["No performance history yet — using default best practices."] };
  const replied = use.filter((r) => r.replied).length;
  const won = use.filter((r) => r.won).length;
  const opening = bestBy(use, "openingStyle");
  const cta = bestBy(use, "ctaType");
  const tone = bestBy(use, "tone");
  const length = bestBy(use, "length");
  const price = bestBy(use, "pricePosition");
  const notes: string[] = [];
  if (opening) notes.push(`Opening "${opening.value}" gets ${(opening.rate * 100).toFixed(0)}% replies (n=${opening.n})`);
  if (cta) notes.push(`CTA "${cta.value}" gets ${(cta.rate * 100).toFixed(0)}% replies (n=${cta.n})`);
  if (tone) notes.push(`Tone ${tone.value} performs best (${(tone.rate * 100).toFixed(0)}%)`);
  if (length) notes.push(`Length ${length.value} performs best (${(length.rate * 100).toFixed(0)}%)`);
  if (price) notes.push(`Price position ${price.value} performs best (${(price.rate * 100).toFixed(0)}%)`);
  return { sampleSize: n, replyRate: replied / n, winRate: won / n, bestOpening: opening?.value, bestCta: cta?.value, bestTone: tone?.value, bestLength: length?.value, bestPricePosition: price?.value, notes };
}

export async function recordProposalFeatures(input: {
  orgId: string; proposalId: string; platformKey: string; category?: string | null; country?: string | null; language: string;
  tone: ProposalTone; length: ProposalLength; openingStyle: string; ctaType: string; pricePosition: string; hasPortfolio: boolean; variantLabel: string;
}) {
  await prisma.performanceMemory.upsert({
    where: { proposalId: input.proposalId },
    create: { organizationId: input.orgId, proposalId: input.proposalId, platformKey: input.platformKey, category: input.category ?? null, country: input.country ?? null, language: input.language, tone: input.tone, length: input.length, openingStyle: input.openingStyle, ctaType: input.ctaType, pricePosition: input.pricePosition, hasPortfolio: input.hasPortfolio, variantLabel: input.variantLabel },
    update: { tone: input.tone, length: input.length, openingStyle: input.openingStyle, ctaType: input.ctaType, pricePosition: input.pricePosition, hasPortfolio: input.hasPortfolio, variantLabel: input.variantLabel, language: input.language },
  });
}

export async function markMemorySent(proposalId: string) {
  await prisma.performanceMemory.updateMany({ where: { proposalId }, data: { sentAt: new Date() } });
}
export async function markMemoryReplied(proposalId: string) {
  await prisma.performanceMemory.updateMany({ where: { proposalId, replied: false }, data: { replied: true, repliedAt: new Date() } });
}
export async function markMemoryWon(proposalId: string) {
  await prisma.performanceMemory.updateMany({ where: { proposalId }, data: { won: true, wonAt: new Date(), replied: true } });
}

export function pricePosition(priceUsd: number, marketUsd: number): "BELOW_MARKET" | "AT_MARKET" | "ABOVE_MARKET" {
  if (!marketUsd) return "AT_MARKET";
  const r = priceUsd / marketUsd;
  return r < 0.9 ? "BELOW_MARKET" : r > 1.1 ? "ABOVE_MARKET" : "AT_MARKET";
}
