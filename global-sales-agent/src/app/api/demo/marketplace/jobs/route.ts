import { NextResponse } from "next/server";
import { generateDemoJobs } from "@/lib/demo/jobs";

/** Fake Marketplace API — public, read-only list of 100 fictional jobs (also usable via generic-api connector). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const country = url.searchParams.get("country");
  const limit = Number(url.searchParams.get("limit") ?? 100);
  let jobs = generateDemoJobs(100);
  if (category) jobs = jobs.filter((j) => j.category === category);
  if (country) jobs = jobs.filter((j) => j.client_country === country);
  return NextResponse.json({ status: "success", data: { items: jobs.slice(0, limit), total: jobs.length } });
}
