import type { PlatformConnector, ConnectorContext, DiscoverParams, NormalizedJob } from "./types";

/**
 * Factory for platforms WITHOUT an official public API (coconala, crowdworks, lancers, peopleperhour ...).
 * Policy: no scraping, no automated posting. Jobs are brought in through manual-import (CSV/JSON/form)
 * and proposals are generated as candidates for a human to send through the platform's own UI.
 */
export function createManualOnlyConnector(def: {
  key: string;
  displayName: string;
  website: string;
  termsUrl?: string;
  notes: string;
  supportedLanguages: string[];
  policy?: "PROHIBITED" | "UNKNOWN" | "RESTRICTED";
}): PlatformConnector {
  return {
    key: def.key,
    displayName: def.displayName,
    website: def.website,
    capabilities: { discover: false, sendProposal: false, fetchReplies: false, webhook: false },
    compliance: {
      officialApi: false,
      automatedSendingPolicy: def.policy ?? "PROHIBITED",
      defaultSendMode: "MANUAL_ONLY",
      termsUrl: def.termsUrl,
      notes: def.notes,
    },
    supportedLanguages: def.supportedLanguages,
    credentialFields: [],
    async discover(_ctx: ConnectorContext, _params: DiscoverParams): Promise<NormalizedJob[]> {
      // No official API: discovery happens via manual-import. Returning [] keeps the scheduler safe.
      return [];
    },
    async testConnection() {
      return { ok: true, message: `${def.displayName}: manual-only mode (no official API). Import jobs via Manual Import; proposals are generated for human sending.` };
    },
  };
}
