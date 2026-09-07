import { prisma } from "../db";
import type { NormalizedJob } from "../connectors/types";
import { toUsd } from "../currency";
import { buildAgentContext } from "../agents/context";
import { runAnalystAgent } from "../agents/analyst";
import { dispatch } from "../agents/orchestrator";
import { logAudit } from "../audit";
import type { JobStatus, Prisma } from "@prisma/client";

/** Upsert normalized jobs → Job + Opportunity(DISCOVERED) + Client. Returns ids of NEW jobs. */
export async function upsertNormalizedJobs(orgId: string, jobs: NormalizedJob[]): Promise<{ created: string[]; updated: number }> {
  const created: string[] = [];
  let updated = 0;
  for (const j of jobs) {
    const existing = await prisma.job.findUnique({ where: { organizationId_platformKey_externalJobId: { organizationId: orgId, platformKey: j.platform, externalJobId: j.job_id } } });
    const data = {
      jobUrl: j.job_url,
      clientName: j.client_name,
      clientCountry: j.client_country,
      clientLanguage: j.client_language,
      projectTitle: j.project_title,
      projectDescription: j.project_description,
      category: j.category,
      requiredSkills: j.required_skills,
      budgetMin: j.budget_min,
      budgetMax: j.budget_max,
      currency: j.currency,
      budgetUsd: toUsd(j.budget_max ?? j.budget_min, j.currency),
      deadline: j.deadline ? new Date(j.deadline) : null,
      proposalDeadline: j.proposal_deadline ? new Date(j.proposal_deadline) : null,
      numberOfCompetitors: j.number_of_competitors,
      clientRating: j.client_rating,
      clientHistory: j.client_history,
      paymentVerified: j.payment_verified,
      postedAt: j.posted_at ? new Date(j.posted_at) : null,
      rawText: j.raw_text,
      sourceMetadata: j.source_metadata as Prisma.InputJsonValue,
    };
    if (existing) {
      await prisma.job.update({ where: { id: existing.id }, data: { numberOfCompetitors: data.numberOfCompetitors, clientRating: data.clientRating, sourceMetadata: data.sourceMetadata } });
      updated += 1;
      continue;
    }
    const id = await prisma.$transaction(async (tx) => {
      let clientId: string | null = null;
      if (j.client_name) {
        const client = await tx.client.findFirst({ where: { organizationId: orgId, platformKey: j.platform, name: j.client_name } });
        const c = client
          ? await tx.client.update({ where: { id: client.id }, data: { rating: j.client_rating, paymentVerified: j.payment_verified, history: j.client_history } })
          : await tx.client.create({ data: { organizationId: orgId, name: j.client_name, platformKey: j.platform, externalClientId: null, country: j.client_country, language: j.client_language, rating: j.client_rating, history: j.client_history, paymentVerified: j.payment_verified } });
        clientId = c.id;
      }
      const job = await tx.job.create({ data: { organizationId: orgId, platformKey: j.platform, externalJobId: j.job_id, ...data } });
      await tx.opportunity.create({ data: { organizationId: orgId, jobId: job.id, clientId, title: j.project_title, status: "DISCOVERED", currency: j.currency, estimatedValueUsd: data.budgetUsd } });
      await tx.activity.create({ data: { organizationId: orgId, type: "JOB_DISCOVERED", title: `Discovered on ${j.platform}: ${j.project_title}`, actorType: "AI", actorId: "scout-agent" } });
      return job.id;
    });
    created.push(id);
  }
  return { created, updated };
}

export async function analyzeJob(orgId: string, jobId: string) {
  const ctx = await buildAgentContext(orgId);
  const result = await runAnalystAgent(ctx, jobId);
  await dispatch(orgId, { type: "JOB_ANALYZED", jobId, qualified: result.qualified });
  return result;
}

export interface JobFilters {
  status?: JobStatus;
  platformKey?: string;
  category?: string;
  country?: string;
  q?: string;
  minScore?: number;
  page?: number;
  pageSize?: number;
  sort?: "score" | "posted" | "budget";
}

export async function listJobs(orgId: string, f: JobFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, f.pageSize ?? 25);
  const where: Prisma.JobWhereInput = {
    organizationId: orgId,
    ...(f.status ? { status: f.status } : {}),
    ...(f.platformKey ? { platformKey: f.platformKey } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.country ? { clientCountry: f.country } : {}),
    ...(f.q ? { OR: [{ projectTitle: { contains: f.q, mode: "insensitive" } }, { projectDescription: { contains: f.q, mode: "insensitive" } }, { clientName: { contains: f.q, mode: "insensitive" } }] } : {}),
    ...(f.minScore ? { analysis: { opportunityScore: { gte: f.minScore } } } : {}),
  };
  const orderBy: Prisma.JobOrderByWithRelationInput = f.sort === "posted" ? { postedAt: "desc" } : f.sort === "budget" ? { budgetUsd: "desc" } : { analysis: { opportunityScore: "desc" } };
  const [items, total] = await Promise.all([
    prisma.job.findMany({ where, include: { analysis: true, opportunity: { select: { id: true, status: true } }, proposal: { select: { id: true, status: true } } }, orderBy: [orderBy, { discoveredAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.job.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getJob(orgId: string, jobId: string) {
  return prisma.job.findFirst({ where: { id: jobId, organizationId: orgId }, include: { analysis: true, opportunity: { include: { client: true, conversation: true, deal: true } }, proposal: { include: { versions: { orderBy: { version: "desc" } } } } } });
}

export async function excludeJob(orgId: string, jobId: string, userId: string, reason: string) {
  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, organizationId: orgId } });
  await prisma.$transaction([
    prisma.job.update({ where: { id: jobId }, data: { status: "EXCLUDED", excludedReason: reason } }),
    prisma.opportunity.updateMany({ where: { jobId, status: { notIn: ["WON"] } }, data: { status: "LOST", lostReason: reason, stageChangedAt: new Date() } }),
  ]);
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "job.excluded", entityType: "job", entityId: jobId, before: { status: job.status }, after: { status: "EXCLUDED" }, reason });
}

export async function importJobs(orgId: string, jobs: NormalizedJob[], userId: string, analyze = true) {
  const res = await upsertNormalizedJobs(orgId, jobs);
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "jobs.imported", entityType: "job", after: { created: res.created.length, updated: res.updated } });
  if (analyze) for (const id of res.created) await dispatch(orgId, { type: "JOB_DISCOVERED", jobId: id });
  return res;
}
