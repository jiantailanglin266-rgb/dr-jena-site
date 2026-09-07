import { prisma } from "../db";
import { getConnector } from "../connectors/registry";
import { decryptJson } from "../crypto";
import type { NormalizedJob, ConnectorContext } from "../connectors/types";
import type { AgentContext } from "./context";
import { logAudit } from "../audit";

/**
 * Scout Agent: iterate enabled platform accounts, call connectors (official APIs / demo / generic), return normalized jobs.
 * Keywords/categories come from org settings & company profile (priority keywords, target categories).
 */
export async function runScoutAgent(ctx: AgentContext, opts: { platformKey?: string; limit?: number } = {}): Promise<{ platformKey: string; jobs: NormalizedJob[]; error?: string }[]> {
  const accounts = await prisma.platformAccount.findMany({ where: { organizationId: ctx.orgId, enabled: true, ...(opts.platformKey ? { platformKey: opts.platformKey } : {}) } });
  const results: { platformKey: string; jobs: NormalizedJob[]; error?: string }[] = [];
  for (const account of accounts) {
    const connector = getConnector(account.platformKey);
    if (!connector.capabilities.discover) continue;
    const cctx: ConnectorContext = {
      orgId: ctx.orgId,
      platformAccountId: account.id,
      credentials: decryptJson<Record<string, string>>(account.credentialsEncrypted) ?? {},
      config: (account.config ?? {}) as Record<string, unknown>,
      logger: { info: (m) => console.log(`[scout:${account.platformKey}] ${m}`), warn: (m) => console.warn(`[scout:${account.platformKey}] ${m}`) },
    };
    try {
      const jobs = await connector.discover(cctx, {
        since: account.lastDiscoveryAt,
        limit: opts.limit ?? 100,
        keywords: ctx.profile.priorityKeywords.length ? ctx.profile.priorityKeywords : undefined,
        categories: ctx.settings.targetCategories.length ? ctx.settings.targetCategories : undefined,
      });
      results.push({ platformKey: account.platformKey, jobs });
      await prisma.platformAccount.update({ where: { id: account.id }, data: { lastDiscoveryAt: new Date() } });
      await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "scout", action: "discovery.run", entityType: "platform_account", entityId: account.id, after: { platformKey: account.platformKey, fetched: jobs.length } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ platformKey: account.platformKey, jobs: [], error: message });
      await logAudit({ orgId: ctx.orgId, actorType: "AI", agent: "scout", action: "discovery.failed", entityType: "platform_account", entityId: account.id, reason: message });
    }
  }
  return results;
}
