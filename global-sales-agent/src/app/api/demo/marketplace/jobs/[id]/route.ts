import { NextResponse } from "next/server";
import { generateDemoJobs } from "@/lib/demo/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = generateDemoJobs(100).find((j) => j.job_id === id);
  return job ? NextResponse.json({ status: "success", data: job }) : NextResponse.json({ status: "error", message: "not found" }, { status: 404 });
}
