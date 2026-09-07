import type { NormalizedJob } from "./types";

/** Build a NormalizedJob with safe defaults. */
export function normalizeJob(platform: string, partial: Partial<NormalizedJob> & { job_id: string; project_title: string; project_description: string }): NormalizedJob {
  return {
    platform,
    job_url: null,
    client_name: null,
    client_country: null,
    client_language: null,
    category: null,
    required_skills: [],
    budget_min: null,
    budget_max: null,
    currency: "USD",
    deadline: null,
    proposal_deadline: null,
    number_of_competitors: null,
    client_rating: null,
    client_history: null,
    payment_verified: false,
    posted_at: null,
    raw_text: `${partial.project_title}\n\n${partial.project_description}`,
    source_metadata: {},
    ...partial,
  };
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toIsoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Resolve a dot-path on an object (used by generic-api mapping). */
export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

export class NotConfiguredError extends Error {
  constructor(platform: string, detail: string) {
    super(`${platform}: ${detail}`);
    this.name = "NotConfiguredError";
  }
}
