import { prisma } from "./db";
import type { ActorType, Prisma } from "@prisma/client";

export interface AuditInput {
  orgId: string;
  actorType: ActorType;
  actorId?: string | null;
  userId?: string | null;
  agent?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

/** 誰が / いつ / どのAIが / どんな判断で / 何をしたか を記録 */
export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.orgId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        userId: input.userId ?? null,
        agent: input.agent ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: toJson(input.before),
        after: toJson(input.after),
        reason: input.reason ?? null,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}
