import { prisma } from "../db";
import { getConnector, listConnectors } from "../connectors/registry";
import { encryptJson, decryptJson, maskSecret } from "../crypto";
import { logAudit } from "../audit";
import { ApiError } from "../errors";
import { PLAN_LIMITS } from "../plans";
import type { SendMode } from "@prisma/client";

/** Ensure Platform rows exist for every registered connector (idempotent). */
export async function syncPlatformCatalog() {
  for (const c of listConnectors()) {
    await prisma.platform.upsert({
      where: { key: c.key },
      create: { key: c.key, displayName: c.displayName, website: c.website ?? null, officialApi: c.compliance.officialApi, automatedSendingPolicy: c.compliance.automatedSendingPolicy, defaultSendMode: c.compliance.defaultSendMode, termsUrl: c.compliance.termsUrl ?? null, complianceNotes: c.compliance.notes, supportedLanguages: c.supportedLanguages },
      update: { displayName: c.displayName, website: c.website ?? null, officialApi: c.compliance.officialApi, automatedSendingPolicy: c.compliance.automatedSendingPolicy, defaultSendMode: c.compliance.defaultSendMode, termsUrl: c.compliance.termsUrl ?? null, complianceNotes: c.compliance.notes, supportedLanguages: c.supportedLanguages },
    });
  }
}

export async function listPlatformAccounts(orgId: string) {
  await syncPlatformCatalog();
  const [platforms, accounts, limits] = await Promise.all([
    prisma.platform.findMany({ orderBy: { displayName: "asc" } }),
    prisma.platformAccount.findMany({ where: { organizationId: orgId } }),
    prisma.platformLimit.findMany({ where: { organizationId: orgId } }),
  ]);
  return platforms.map((p) => {
    const a = accounts.find((x) => x.platformKey === p.key);
    const l = limits.find((x) => x.platformKey === p.key);
    const connector = getConnector(p.key);
    const creds = decryptJson<Record<string, string>>(a?.credentialsEncrypted) ?? {};
    const masked = Object.fromEntries(Object.entries(creds).map(([k, v]) => [k, connector.credentialFields.find((f) => f.key === k)?.secret ? maskSecret(v) : v]));
    return {
      platform: p,
      connector: { capabilities: connector.capabilities, credentialFields: connector.credentialFields, compliance: connector.compliance },
      account: a ? { id: a.id, label: a.label, enabled: a.enabled, sendMode: a.sendMode, config: a.config, credentials: masked, lastDiscoveryAt: a.lastDiscoveryAt, lastReplyPollAt: a.lastReplyPollAt } : null,
      limits: l ? { dailyLimit: l.dailyLimit, hourlyLimit: l.hourlyLimit, maxContactsPerClientPerWeek: l.maxContactsPerClientPerWeek } : { dailyLimit: 20, hourlyLimit: 5, maxContactsPerClientPerWeek: 2 },
    };
  });
}

export async function upsertPlatformAccount(orgId: string, userId: string, input: { platformKey: string; label?: string; enabled?: boolean; sendMode?: SendMode; credentials?: Record<string, string>; config?: Record<string, unknown> }) {
  const connector = getConnector(input.platformKey);
  const platform = await prisma.platform.findUnique({ where: { key: input.platformKey } });
  if (!platform) throw new ApiError("Unknown platform", 404);
  if (input.sendMode === "AUTO" && (connector.compliance.automatedSendingPolicy === "PROHIBITED" || !connector.capabilities.sendProposal)) throw new ApiError(`${connector.displayName} does not allow automated sending`, 422);
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  const existing = await prisma.platformAccount.findUnique({ where: { organizationId_platformKey: { organizationId: orgId, platformKey: input.platformKey } } });
  if (!existing) {
    const count = await prisma.platformAccount.count({ where: { organizationId: orgId } });
    if (count >= PLAN_LIMITS[org.plan].maxPlatformAccounts) throw new ApiError(`Plan ${org.plan} allows ${PLAN_LIMITS[org.plan].maxPlatformAccounts} platform accounts`, 402);
  }
  // Merge credentials: keep old secret values when the masked value is sent back unchanged
  const old = decryptJson<Record<string, string>>(existing?.credentialsEncrypted) ?? {};
  const merged = { ...old };
  for (const [k, v] of Object.entries(input.credentials ?? {})) {
    if (v && v.includes("••••") && old[k]) continue;
    if (v === "") delete merged[k];
    else merged[k] = v;
  }
  const account = await prisma.platformAccount.upsert({
    where: { organizationId_platformKey: { organizationId: orgId, platformKey: input.platformKey } },
    create: { organizationId: orgId, platformId: platform.id, platformKey: input.platformKey, label: input.label ?? connector.displayName, enabled: input.enabled ?? true, sendMode: input.sendMode ?? connector.compliance.defaultSendMode, credentialsEncrypted: Object.keys(merged).length ? encryptJson(merged) : null, config: (input.config ?? {}) as object },
    update: { label: input.label, enabled: input.enabled, sendMode: input.sendMode, credentialsEncrypted: Object.keys(merged).length ? encryptJson(merged) : null, ...(input.config ? { config: input.config as object } : {}) },
  });
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "platform_account.upsert", entityType: "platform_account", entityId: account.id, after: { platformKey: input.platformKey, enabled: account.enabled, sendMode: account.sendMode, credentialKeys: Object.keys(merged) } });
  return account;
}

export async function upsertPlatformLimit(orgId: string, userId: string, input: { platformKey: string; dailyLimit: number; hourlyLimit: number; maxContactsPerClientPerWeek: number }) {
  const platform = await prisma.platform.findUnique({ where: { key: input.platformKey } });
  if (!platform) throw new ApiError("Unknown platform", 404);
  const l = await prisma.platformLimit.upsert({
    where: { organizationId_platformKey: { organizationId: orgId, platformKey: input.platformKey } },
    create: { organizationId: orgId, platformId: platform.id, platformKey: input.platformKey, dailyLimit: input.dailyLimit, hourlyLimit: input.hourlyLimit, maxContactsPerClientPerWeek: input.maxContactsPerClientPerWeek },
    update: { dailyLimit: input.dailyLimit, hourlyLimit: input.hourlyLimit, maxContactsPerClientPerWeek: input.maxContactsPerClientPerWeek },
  });
  await logAudit({ orgId, actorType: "USER", userId, actorId: userId, action: "platform_limit.upsert", entityType: "platform_limit", entityId: l.id, after: input });
  return l;
}

export async function testPlatformConnection(orgId: string, platformKey: string) {
  const connector = getConnector(platformKey);
  const account = await prisma.platformAccount.findUnique({ where: { organizationId_platformKey: { organizationId: orgId, platformKey } } });
  return connector.testConnection({ orgId, platformAccountId: account?.id ?? "", credentials: decryptJson<Record<string, string>>(account?.credentialsEncrypted) ?? {}, config: (account?.config ?? {}) as Record<string, unknown> });
}
