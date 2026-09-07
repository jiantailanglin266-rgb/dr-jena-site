import type { PlatformConnector, NormalizedJob } from "../types";
import { normalizeJob, toIsoOrNull, toNumberOrNull } from "../base";
import { z } from "zod";

export const manualJobSchema = z.object({
  platform: z.string().default("manual-import"),
  job_id: z.string().optional(),
  job_url: z.string().optional().nullable(),
  client_name: z.string().optional().nullable(),
  client_country: z.string().optional().nullable(),
  client_language: z.string().optional().nullable(),
  project_title: z.string().min(1),
  project_description: z.string().min(1),
  category: z.string().optional().nullable(),
  required_skills: z.union([z.array(z.string()), z.string()]).optional(),
  budget_min: z.union([z.number(), z.string()]).optional().nullable(),
  budget_max: z.union([z.number(), z.string()]).optional().nullable(),
  currency: z.string().optional(),
  deadline: z.string().optional().nullable(),
  proposal_deadline: z.string().optional().nullable(),
  number_of_competitors: z.union([z.number(), z.string()]).optional().nullable(),
  client_rating: z.union([z.number(), z.string()]).optional().nullable(),
  client_history: z.string().optional().nullable(),
  payment_verified: z.union([z.boolean(), z.string()]).optional(),
  posted_at: z.string().optional().nullable(),
});

export function importRowToJob(row: z.infer<typeof manualJobSchema>): NormalizedJob {
  const skills = Array.isArray(row.required_skills) ? row.required_skills : (row.required_skills ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const id = row.job_id || `manual-${Buffer.from(`${row.project_title}|${row.job_url ?? ""}`).toString("base64url").slice(0, 24)}`;
  return normalizeJob(row.platform || "manual-import", {
    job_id: id,
    job_url: row.job_url ?? null,
    client_name: row.client_name ?? null,
    client_country: row.client_country ?? null,
    client_language: row.client_language ?? null,
    project_title: row.project_title,
    project_description: row.project_description,
    category: row.category ?? null,
    required_skills: skills,
    budget_min: toNumberOrNull(row.budget_min),
    budget_max: toNumberOrNull(row.budget_max),
    currency: row.currency ?? "USD",
    deadline: toIsoOrNull(row.deadline),
    proposal_deadline: toIsoOrNull(row.proposal_deadline),
    number_of_competitors: toNumberOrNull(row.number_of_competitors),
    client_rating: toNumberOrNull(row.client_rating),
    client_history: row.client_history ?? null,
    payment_verified: row.payment_verified === true || row.payment_verified === "true",
    posted_at: toIsoOrNull(row.posted_at) ?? new Date().toISOString(),
    source_metadata: { imported: true },
  });
}

/** Minimal CSV parser (RFC4180-ish, handles quoted fields). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = ""; rows.push(cur); cur = [];
    } else field += c;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ""));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export const manualImportConnector: PlatformConnector = {
  key: "manual-import",
  displayName: "Manual Import (CSV / JSON / Form)",
  capabilities: { discover: false, sendProposal: false, fetchReplies: false, webhook: false },
  compliance: { officialApi: false, automatedSendingPolicy: "UNKNOWN", defaultSendMode: "MANUAL_ONLY", notes: "Jobs you paste or upload yourself. Proposals are generated as candidates for human sending." },
  supportedLanguages: ["*"],
  credentialFields: [],
  async discover() {
    return [];
  },
  async testConnection() {
    return { ok: true, message: "Manual import ready — POST /api/jobs/import" };
  },
};
