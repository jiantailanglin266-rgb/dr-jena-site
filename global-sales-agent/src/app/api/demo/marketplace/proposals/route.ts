import { NextResponse } from "next/server";

/** Fake Marketplace API — accepts a proposal submission (no persistence; the connector simulates client replies). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { job_id?: string; text?: string };
  if (!body.job_id || !body.text) return NextResponse.json({ status: "error", message: "job_id and text required" }, { status: 400 });
  return NextResponse.json({ status: "success", data: { proposal_id: `DEMO-PROP-${Date.now()}`, thread_id: `DEMO-THREAD-${body.job_id}`, accepted_at: new Date().toISOString() } });
}
