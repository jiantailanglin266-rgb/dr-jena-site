import { prisma } from "../db";
import type { Prisma } from "@prisma/client";

export async function listCompanies(orgId: string, q?: string, page = 1, pageSize = 25) {
  const where: Prisma.ClientWhereInput = { organizationId: orgId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) };
  const [items, total] = await Promise.all([
    prisma.client.findMany({ where, include: { _count: { select: { opportunities: true, contacts: true, deals: true } } }, orderBy: [{ totalWonValueUsd: "desc" }, { updatedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.client.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getCompany(orgId: string, id: string) {
  return prisma.client.findFirst({ where: { id, organizationId: orgId }, include: { contacts: true, opportunities: { include: { job: { select: { projectTitle: true, platformKey: true } }, deal: true }, orderBy: { updatedAt: "desc" } }, deals: true } });
}

export async function updateCompany(orgId: string, id: string, data: { name?: string; website?: string | null; industry?: string | null; notes?: string | null; country?: string | null; language?: string | null }) {
  await prisma.client.findFirstOrThrow({ where: { id, organizationId: orgId } });
  return prisma.client.update({ where: { id }, data });
}

export async function listContacts(orgId: string, clientId?: string) {
  return prisma.contact.findMany({ where: { organizationId: orgId, ...(clientId ? { clientId } : {}) }, include: { client: { select: { id: true, name: true, country: true } } }, orderBy: { updatedAt: "desc" }, take: 200 });
}

export async function createContact(orgId: string, data: { clientId: string; name: string; email?: string | null; role?: string | null; language?: string | null; timezone?: string | null; notes?: string | null }) {
  await prisma.client.findFirstOrThrow({ where: { id: data.clientId, organizationId: orgId } });
  return prisma.contact.create({ data: { organizationId: orgId, ...data } });
}

export async function listDeals(orgId: string) {
  return prisma.deal.findMany({ where: { organizationId: orgId }, include: { opportunity: { include: { job: { select: { projectTitle: true, platformKey: true, clientCountry: true } } } }, client: { select: { id: true, name: true } }, approvedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 });
}

export async function getDeal(orgId: string, id: string) {
  return prisma.deal.findFirst({ where: { id, organizationId: orgId }, include: { opportunity: { include: { job: true, conversation: true, quotes: { orderBy: { version: "desc" } } } }, client: true, approvedBy: { select: { name: true, email: true } } } });
}

export async function listOpportunities(orgId: string) {
  return prisma.opportunity.findMany({ where: { organizationId: orgId, job: { status: { not: "EXCLUDED" } } }, include: { job: { select: { projectTitle: true, platformKey: true, clientName: true, clientCountry: true, category: true, currency: true, analysis: { select: { opportunityScore: true } } } }, proposal: { select: { status: true } }, conversation: { select: { id: true, lastInboundAt: true } }, deal: { select: { id: true, status: true } } }, orderBy: { stageChangedAt: "desc" }, take: 500 });
}

export async function listActivities(orgId: string, opportunityId?: string, take = 50) {
  return prisma.activity.findMany({ where: { organizationId: orgId, ...(opportunityId ? { opportunityId } : {}) }, orderBy: { createdAt: "desc" }, take });
}

export async function listTasks(orgId: string, status: "OPEN" | "DONE" | "CANCELLED" = "OPEN") {
  return prisma.task.findMany({ where: { organizationId: orgId, status }, include: { opportunity: { select: { id: true, title: true, status: true, deal: { select: { id: true } } } }, assignee: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function updateTask(orgId: string, id: string, data: { status?: "OPEN" | "DONE" | "CANCELLED"; assigneeUserId?: string | null; dueAt?: Date | null }) {
  await prisma.task.findFirstOrThrow({ where: { id, organizationId: orgId } });
  return prisma.task.update({ where: { id }, data });
}
