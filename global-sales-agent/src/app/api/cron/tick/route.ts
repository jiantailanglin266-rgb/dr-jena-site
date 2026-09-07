import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runDiscovery } from "@/lib/services/discovery";
import { pollReplies } from "@/lib/services/conversations";
import { flushScheduled } from "@/lib/sending/send-engine";

export const maxDuration = 300;

/**
 * Serverless scheduler tick (Vercel Cron / any external cron) — replaces the worker's scheduler when no
 * long-running worker exists. Protected by CRON_SECRET (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const orgs = await prisma.organization.findMany({ select: { id: true, slug: true } });
  const results: Record<string, unknown> = {};
  for (const org of orgs) {
    try {
      const discovery = await runDiscovery(org.id, { limit: 100 });
      const replies = await pollReplies(org.id);
      results[org.slug] = { discovered: discovery.created, replies: replies.reduce((s, r) => s + r.received, 0) };
    } catch (e) {
      results[org.slug] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  const flushed = await flushScheduled();
  return NextResponse.json({ ok: true, results, flushed: flushed.length, at: new Date().toISOString() });
}
