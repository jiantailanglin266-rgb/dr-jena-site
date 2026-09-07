import type { PlatformConnector, ConnectorContext, DiscoverParams, NormalizedJob, SendProposalInput, SendResult, InboundMessage } from "../types";
import { normalizeJob, NotConfiguredError, toNumberOrNull } from "../base";

/**
 * Freelancer.com connector — official REST API (https://developers.freelancer.com).
 * Auth: header `freelancer-oauth-v1: <token>`.
 */
const BASE = "https://www.freelancer.com/api";

async function api<T>(ctx: ConnectorContext, path: string, init?: RequestInit): Promise<T> {
  const token = ctx.credentials.oauthToken;
  if (!token) throw new NotConfiguredError("freelancer", "oauthToken missing");
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "freelancer-oauth-v1": token, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`Freelancer API ${res.status}`);
  const json = (await res.json()) as { status: string; result: T; message?: string };
  if (json.status !== "success") throw new Error(`Freelancer API: ${json.message ?? "error"}`);
  return json.result;
}

interface FlProject {
  id: number;
  title: string;
  description?: string;
  preview_description?: string;
  seo_url?: string;
  currency?: { code?: string };
  budget?: { minimum?: number; maximum?: number };
  bid_stats?: { bid_count?: number };
  jobs?: { name: string }[];
  time_submitted?: number;
  owner_id?: number;
  bidperiod?: number;
  language?: string;
}

export function mapFreelancerProject(p: FlProject, owner?: { display_name?: string; location?: { country?: { code?: string } }; reputation?: { entire_history?: { overall?: number } }; status?: { payment_verified?: boolean } }): NormalizedJob {
  return normalizeJob("freelancer", {
    job_id: String(p.id),
    job_url: p.seo_url ? `https://www.freelancer.com/projects/${p.seo_url}` : null,
    project_title: p.title,
    project_description: p.description ?? p.preview_description ?? "",
    required_skills: (p.jobs ?? []).map((j) => j.name),
    budget_min: toNumberOrNull(p.budget?.minimum),
    budget_max: toNumberOrNull(p.budget?.maximum),
    currency: p.currency?.code ?? "USD",
    number_of_competitors: p.bid_stats?.bid_count ?? null,
    posted_at: p.time_submitted ? new Date(p.time_submitted * 1000).toISOString() : null,
    proposal_deadline: p.time_submitted && p.bidperiod ? new Date((p.time_submitted + p.bidperiod * 86400) * 1000).toISOString() : null,
    client_name: owner?.display_name ?? null,
    client_country: owner?.location?.country?.code ?? null,
    client_language: p.language ?? "en",
    client_rating: toNumberOrNull(owner?.reputation?.entire_history?.overall),
    payment_verified: owner?.status?.payment_verified ?? false,
    source_metadata: { owner_id: p.owner_id },
  });
}

export const freelancerConnector: PlatformConnector = {
  key: "freelancer",
  displayName: "Freelancer.com",
  website: "https://www.freelancer.com",
  capabilities: { discover: true, sendProposal: true, fetchReplies: true, webhook: false },
  compliance: {
    officialApi: true,
    automatedSendingPolicy: "ALLOWED",
    defaultSendMode: "MANUAL_APPROVAL",
    termsUrl: "https://www.freelancer.com/about/terms",
    notes: "Official REST API supports project search and bid placement within API terms and rate limits. Default: human approval before sending.",
  },
  supportedLanguages: ["en", "es", "pt", "fr", "de", "it"],
  credentialFields: [
    { key: "oauthToken", label: "OAuth Token", secret: true },
    { key: "bidderId", label: "Bidder (user) ID" },
  ],
  async discover(ctx, params: DiscoverParams) {
    const q = new URLSearchParams({ limit: String(params.limit ?? 50), full_description: "true", job_details: "true", user_details: "true", user_country_details: "true", user_reputation: "true", user_status: "true" });
    if (params.keywords?.length) q.set("query", params.keywords.join(" "));
    const result = await api<{ projects: FlProject[]; users?: Record<string, Parameters<typeof mapFreelancerProject>[1]> }>(ctx, `/projects/0.1/projects/active/?${q.toString()}`);
    return (result.projects ?? []).map((p) => mapFreelancerProject(p, result.users?.[String(p.owner_id)]));
  },
  async sendProposal(ctx, input: SendProposalInput): Promise<SendResult> {
    const bidderId = Number(ctx.credentials.bidderId);
    if (!bidderId) return { ok: false, error: "bidderId missing" };
    const result = await api<{ id: number }>(ctx, `/projects/0.1/bids/`, {
      method: "POST",
      body: JSON.stringify({ project_id: Number(input.jobExternalId), bidder_id: bidderId, amount: input.price, period: input.deliveryDays ?? 14, milestone_percentage: 100, description: input.text }),
    });
    return { ok: true, externalProposalId: String(result.id) };
  },
  async fetchReplies(ctx, since): Promise<InboundMessage[]> {
    const q = new URLSearchParams({ limit: "50" });
    if (since) q.set("from_updated_time", String(Math.floor(since.getTime() / 1000)));
    try {
      const result = await api<{ messages?: { id: number; thread_id: number; message: string; time_created: number; from_user: number; thread?: { context?: { id?: number } } }[] }>(ctx, `/messages/0.1/messages/?${q.toString()}`);
      return (result.messages ?? []).map((m) => ({
        externalThreadId: String(m.thread_id),
        externalMessageId: String(m.id),
        jobExternalId: String(m.thread?.context?.id ?? ""),
        text: m.message,
        receivedAt: new Date(m.time_created * 1000).toISOString(),
      }));
    } catch {
      return [];
    }
  },
  async testConnection(ctx) {
    if (!ctx.credentials.oauthToken) return { ok: false, message: "oauthToken not configured" };
    try {
      await api(ctx, `/users/0.1/self/`);
      return { ok: true, message: "Freelancer API reachable" };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "error" };
    }
  },
};
