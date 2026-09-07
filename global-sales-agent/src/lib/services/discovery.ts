import { prisma } from "../db";
import { buildAgentContext } from "../agents/context";
import { runScoutAgent } from "../agents/scout";
import { upsertNormalizedJobs } from "./jobs";
import { dispatch } from "../agents/orchestrator";
import { PLAN_LIMITS } from "../plans";

/** Discovery run = Scout Agent → normalize/upsert → JOB_DISCOVERED events (→ analysis). */
export async function runDiscovery(orgId: string, opts: { platformKey?: string; limit?: number; analyze?: boolean } = {}) {
  const ctx = await buildAgentContext(orgId);
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true } });
  const limit = Math.min(opts.limit ?? 100, PLAN_LIMITS[org.plan].maxJobsPerDiscovery);
  const results = await runScoutAgent(ctx, { platformKey: opts.platformKey, limit });
  const summary: { platformKey: string; fetched: number; created: number; updated: number; error?: string }[] = [];
  const createdIds: string[] = [];
  for (const r of results) {
    const { created, updated } = await upsertNormalizedJobs(orgId, r.jobs);
    createdIds.push(...created);
    summary.push({ platformKey: r.platformKey, fetched: r.jobs.length, created: created.length, updated, error: r.error });
  }
  if (opts.analyze !== false) {
    for (const id of createdIds) await dispatch(orgId, { type: "JOB_DISCOVERED", jobId: id });
  }
  return { summary, created: createdIds.length };
}
