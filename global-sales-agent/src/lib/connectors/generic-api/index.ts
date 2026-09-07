import type { PlatformConnector, ConnectorContext, DiscoverParams, NormalizedJob } from "../types";
import { normalizeJob, getPath, toIsoOrNull, toNumberOrNull } from "../base";
import { verifyWebhookSignature } from "../../crypto";

/**
 * Generic JSON API connector. Configure in Settings → Platforms:
 * config = {
 *   url: "https://example.com/jobs?since={since}",
 *   method: "GET",
 *   headers: { "X-Api-Key": "{apiKey}" },      // {apiKey} resolved from credentials
 *   itemsPath: "data.items",
 *   mapping: { job_id: "id", project_title: "title", project_description: "body", budget_max: "budget.max", currency: "budget.currency", client_country: "client.country", posted_at: "created_at", required_skills: "tags", job_url: "url" },
 *   defaults: { currency: "USD", client_language: "en" }
 * }
 */
export interface GenericApiConfig {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  itemsPath?: string;
  mapping: Record<string, string>;
  defaults?: Record<string, unknown>;
}

export function mapGenericItem(item: unknown, cfg: GenericApiConfig): NormalizedJob | null {
  const get = (field: string) => (cfg.mapping[field] ? getPath(item, cfg.mapping[field]) : cfg.defaults?.[field]);
  const id = get("job_id");
  const title = get("project_title");
  if (!id || !title) return null;
  const skills = get("required_skills");
  return normalizeJob("generic-api", {
    job_id: String(id),
    project_title: String(title),
    project_description: String(get("project_description") ?? ""),
    job_url: (get("job_url") as string) ?? null,
    client_name: (get("client_name") as string) ?? null,
    client_country: (get("client_country") as string) ?? null,
    client_language: (get("client_language") as string) ?? null,
    category: (get("category") as string) ?? null,
    required_skills: Array.isArray(skills) ? skills.map(String) : typeof skills === "string" ? skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
    budget_min: toNumberOrNull(get("budget_min")),
    budget_max: toNumberOrNull(get("budget_max")),
    currency: String(get("currency") ?? "USD"),
    deadline: toIsoOrNull(get("deadline")),
    proposal_deadline: toIsoOrNull(get("proposal_deadline")),
    number_of_competitors: toNumberOrNull(get("number_of_competitors")),
    client_rating: toNumberOrNull(get("client_rating")),
    client_history: (get("client_history") as string) ?? null,
    payment_verified: Boolean(get("payment_verified") ?? false),
    posted_at: toIsoOrNull(get("posted_at")),
    source_metadata: { raw: item as Record<string, unknown> },
  });
}

function interpolate(s: string, vars: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export const genericApiConnector: PlatformConnector = {
  key: "generic-api",
  displayName: "Generic JSON API",
  capabilities: { discover: true, sendProposal: false, fetchReplies: false, webhook: true },
  compliance: { officialApi: true, automatedSendingPolicy: "UNKNOWN", defaultSendMode: "MANUAL_APPROVAL", notes: "Use only with APIs you are authorised to call. Sending is manual unless a custom connector is added." },
  supportedLanguages: ["*"],
  credentialFields: [{ key: "apiKey", label: "API Key", secret: true }],
  async discover(ctx: ConnectorContext, params: DiscoverParams) {
    const cfg = ctx.config as unknown as GenericApiConfig;
    if (!cfg?.url || !cfg?.mapping) return [];
    const vars = { ...ctx.credentials, since: params.since?.toISOString() ?? "", limit: String(params.limit ?? 50) };
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg.headers ?? {})) headers[k] = interpolate(v, vars);
    const res = await fetch(interpolate(cfg.url, vars), { method: cfg.method ?? "GET", headers, ...(cfg.method === "POST" ? { body: JSON.stringify(cfg.body ?? {}) } : {}) });
    if (!res.ok) throw new Error(`generic-api ${res.status}`);
    const json = await res.json();
    const items = (cfg.itemsPath ? getPath(json, cfg.itemsPath) : json) as unknown[];
    if (!Array.isArray(items)) return [];
    return items.map((i) => mapGenericItem(i, cfg)).filter((j): j is NormalizedJob => Boolean(j)).slice(0, params.limit ?? 50);
  },
  verifyWebhook(rawBody, headers, secret) {
    return verifyWebhookSignature(secret, headers["x-timestamp"] ?? "", rawBody, headers["x-signature"] ?? "");
  },
  async testConnection(ctx) {
    const cfg = ctx.config as unknown as GenericApiConfig;
    if (!cfg?.url) return { ok: false, message: "config.url missing" };
    try {
      const jobs = await this.discover(ctx, { limit: 1 });
      return { ok: true, message: `Fetched ${jobs.length} item(s)` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "error" };
    }
  },
};
