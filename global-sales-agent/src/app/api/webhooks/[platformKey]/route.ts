import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getConnector, hasConnector } from "@/lib/connectors/registry";
import { ingestInbound } from "@/lib/services/conversations";
import { checkRateLimit } from "@/lib/rate-limit";

const payload = z.object({
  orgSlug: z.string(),
  messages: z.array(z.object({ externalThreadId: z.string(), externalMessageId: z.string(), jobExternalId: z.string(), text: z.string().min(1), receivedAt: z.string().optional(), clientName: z.string().optional(), hint: z.string().optional() })),
});

/** Inbound webhook: HMAC-verified (per connector) → ingest client messages → REPLY_RECEIVED. */
export async function POST(req: Request, { params }: { params: Promise<{ platformKey: string }> }) {
  const { platformKey } = await params;
  if (!hasConnector(platformKey)) return NextResponse.json({ ok: false, error: "unknown platform" }, { status: 404 });
  const rl = await checkRateLimit(`webhook:${platformKey}`, 600, 60);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 });
  const raw = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const connector = getConnector(platformKey);
  const secret = process.env.WEBHOOK_SIGNING_SECRET ?? "";
  if (!connector.verifyWebhook || !secret || !connector.verifyWebhook(raw, headers, secret)) return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  const parsed = payload.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 422 });
  const org = await prisma.organization.findUnique({ where: { slug: parsed.data.orgSlug } });
  if (!org) return NextResponse.json({ ok: false, error: "unknown org" }, { status: 404 });
  let ingested = 0;
  for (const m of parsed.data.messages) {
    const id = await ingestInbound(org.id, platformKey, { ...m, receivedAt: m.receivedAt ?? new Date().toISOString() });
    if (id) ingested += 1;
  }
  return NextResponse.json({ ok: true, ingested });
}
