import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueMode } from "@/lib/queue";
import { isDemoMode } from "@/lib/ai/provider";

export async function GET() {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  return NextResponse.json({ ok: db === "ok", db, queue: queueMode(), demo: isDemoMode(), time: new Date().toISOString() });
}
