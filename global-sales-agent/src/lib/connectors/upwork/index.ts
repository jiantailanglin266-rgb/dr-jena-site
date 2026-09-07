import type { PlatformConnector, ConnectorContext, DiscoverParams, NormalizedJob, SendProposalInput, SendResult, InboundMessage } from "../types";
import { normalizeJob, NotConfiguredError, toIsoOrNull, toNumberOrNull } from "../base";

/**
 * Upwork connector — official GraphQL API (OAuth2).
 * Job search is available to approved API apps; submitting proposals via API requires
 * specific partner permissions, so the default send mode is MANUAL_APPROVAL and `sendProposal`
 * only runs when `credentials.allowAutomatedProposals === "true"`.
 *
 * Replace `mapUpworkJob` / query strings to match the API version you are approved for.
 */
const GRAPHQL_URL = "https://api.upwork.com/graphql";

async function gql<T>(ctx: ConnectorContext, query: string, variables: Record<string, unknown>): Promise<T> {
  const token = ctx.credentials.accessToken;
  if (!token) throw new NotConfiguredError("upwork", "accessToken missing (complete OAuth2 in Settings → Platforms)");
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(ctx.credentials.orgId ? { "X-Upwork-API-TenantId": ctx.credentials.orgId } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Upwork API ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`Upwork API: ${json.errors[0].message}`);
  return json.data as T;
}

interface UpworkJobNode {
  id: string;
  title: string;
  description: string;
  ciphertext?: string;
  createdDateTime?: string;
  category?: string;
  skills?: { name: string }[];
  amount?: { rawValue?: string; currency?: string };
  hourlyBudgetMin?: { rawValue?: string };
  hourlyBudgetMax?: { rawValue?: string };
  client?: { location?: { country?: string }; totalFeedback?: number; verificationStatus?: string; totalSpent?: { rawValue?: string } };
  totalApplicants?: number;
}

export function mapUpworkJob(n: UpworkJobNode): NormalizedJob {
  const fixed = toNumberOrNull(n.amount?.rawValue);
  return normalizeJob("upwork", {
    job_id: n.id,
    job_url: n.ciphertext ? `https://www.upwork.com/jobs/${n.ciphertext}` : null,
    project_title: n.title,
    project_description: n.description,
    category: n.category ?? null,
    required_skills: (n.skills ?? []).map((s) => s.name),
    budget_min: fixed ?? toNumberOrNull(n.hourlyBudgetMin?.rawValue),
    budget_max: fixed ?? toNumberOrNull(n.hourlyBudgetMax?.rawValue),
    currency: n.amount?.currency ?? "USD",
    client_country: n.client?.location?.country ?? null,
    client_language: "en",
    client_rating: toNumberOrNull(n.client?.totalFeedback),
    client_history: n.client?.totalSpent?.rawValue ? `Total spent: ${n.client.totalSpent.rawValue}` : null,
    payment_verified: n.client?.verificationStatus === "VERIFIED",
    number_of_competitors: n.totalApplicants ?? null,
    posted_at: toIsoOrNull(n.createdDateTime),
    source_metadata: { ciphertext: n.ciphertext },
  });
}

export const upworkConnector: PlatformConnector = {
  key: "upwork",
  displayName: "Upwork",
  website: "https://www.upwork.com",
  capabilities: { discover: true, sendProposal: true, fetchReplies: true, webhook: false },
  compliance: {
    officialApi: true,
    automatedSendingPolicy: "RESTRICTED",
    defaultSendMode: "MANUAL_APPROVAL",
    termsUrl: "https://www.upwork.com/legal#api",
    notes: "Official GraphQL API (OAuth2). Job search allowed for approved apps. Proposal submission requires partner-level permission; default to human approval.",
  },
  supportedLanguages: ["en"],
  credentialFields: [
    { key: "clientId", label: "Client ID" },
    { key: "clientSecret", label: "Client Secret", secret: true },
    { key: "accessToken", label: "Access Token", secret: true },
    { key: "orgId", label: "Tenant / Organization ID" },
    { key: "allowAutomatedProposals", label: "Automated proposals approved by Upwork (true/false)" },
  ],
  async discover(ctx, params: DiscoverParams) {
    const query = `query Search($q: String, $first: Int) { marketplaceJobPostingsSearch(marketPlaceJobFilter: { searchExpression_eq: $q }, searchType: USER_JOBS_SEARCH, sortAttributes: [{ field: RECENCY }], pagination: { first: $first }) { edges { node { id title description ciphertext createdDateTime category skills { name } amount { rawValue currency } hourlyBudgetMin { rawValue } hourlyBudgetMax { rawValue } client { location { country } totalFeedback verificationStatus totalSpent { rawValue } } totalApplicants } } } }`;
    const data = await gql<{ marketplaceJobPostingsSearch?: { edges: { node: UpworkJobNode }[] } }>(ctx, query, { q: (params.keywords ?? []).join(" ") || null, first: params.limit ?? 50 });
    return (data.marketplaceJobPostingsSearch?.edges ?? []).map((e) => mapUpworkJob(e.node));
  },
  async sendProposal(ctx, input: SendProposalInput): Promise<SendResult> {
    if (ctx.credentials.allowAutomatedProposals !== "true") {
      return { ok: false, error: "Automated proposal submission not enabled for this Upwork app. Use MANUAL_APPROVAL/MANUAL_ONLY." };
    }
    const mutation = `mutation Submit($input: SubmitProposalInput!) { submitProposal(input: $input) { id } }`;
    const data = await gql<{ submitProposal?: { id: string } }>(ctx, mutation, { input: { jobPostingId: input.jobExternalId, coverLetter: input.text, chargedAmount: input.price } });
    return data.submitProposal ? { ok: true, externalProposalId: data.submitProposal.id } : { ok: false, error: "No proposal id returned" };
  },
  async fetchReplies(_ctx, _since): Promise<InboundMessage[]> {
    // Upwork messaging API (rooms/stories) mapping goes here once your app is approved for messaging scope.
    return [];
  },
  async testConnection(ctx) {
    if (!ctx.credentials.accessToken) return { ok: false, message: "accessToken not configured" };
    try {
      await gql(ctx, `query { user { id } }`, {});
      return { ok: true, message: "Upwork API reachable" };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "error" };
    }
  },
};
