import type { Proposal, ProposalVersion } from "@prisma/client";
import { dec } from "@/lib/utils";

/** Serializable shape of a proposal for client components (no Decimal / Date objects). */
export type ComplianceIssue = { code?: string; severity: string; message: string };

export type ProposalVersionView = {
  id: string;
  version: number;
  authorType: string;
  changeReason: string | null;
  length: string;
  tone: string;
  createdAt: string;
  proposalTranslated: string;
  proposalOriginal: string;
};

export type ProposalView = {
  id: string;
  jobId: string;
  opportunityId: string;
  platformKey: string;
  status: string;
  sendMode: string;
  length: string;
  tone: string;
  variantLabel: string;
  detectedLanguage: string;
  sourceLanguage: string;
  proposalOriginal: string;
  proposalTranslated: string;
  subject: string;
  sections: Record<string, string>;
  ctaType: string | null;
  openingStyle: string | null;
  proposedPrice: number | null;
  proposedPriceUsd: number | null;
  currency: string;
  proposedDeliveryDays: number | null;
  compliance: { allowed?: boolean; issues: ComplianceIssue[] };
  approvedAt: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  failedReason: string | null;
  externalProposalId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: ProposalVersionView[];
};

export const SECTION_ORDER: { key: string; label: string }[] = [
  { key: "understanding", label: "Understanding" },
  { key: "solution", label: "Solution" },
  { key: "approach", label: "Approach" },
  { key: "similar_experience", label: "Similar experience" },
  { key: "timeline", label: "Timeline" },
  { key: "delivery", label: "Delivery" },
  { key: "pricing", label: "Pricing" },
  { key: "risks", label: "Risks" },
  { key: "next_action", label: "Next action" },
  { key: "closing", label: "Closing" },
];

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toProposalView(p: Proposal & { versions?: ProposalVersion[] }): ProposalView {
  const structured = (p.structured ?? {}) as Record<string, unknown>;
  const rawSections = (structured.sections ?? {}) as Record<string, unknown>;
  const sections: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawSections)) if (typeof v === "string") sections[k] = v;
  const compliance = (p.complianceResult ?? {}) as { allowed?: boolean; issues?: ComplianceIssue[] };
  return {
    id: p.id,
    jobId: p.jobId,
    opportunityId: p.opportunityId,
    platformKey: p.platformKey,
    status: p.status,
    sendMode: p.sendMode,
    length: p.length,
    tone: p.tone,
    variantLabel: p.variantLabel,
    detectedLanguage: p.detectedLanguage,
    sourceLanguage: p.sourceLanguage,
    proposalOriginal: p.proposalOriginal,
    proposalTranslated: p.proposalTranslated,
    subject: typeof structured.subject === "string" ? structured.subject : "",
    sections,
    ctaType: typeof structured.cta_type === "string" ? structured.cta_type : null,
    openingStyle: typeof structured.opening_style === "string" ? structured.opening_style : null,
    proposedPrice: p.proposedPrice === null ? null : dec(p.proposedPrice),
    proposedPriceUsd: p.proposedPriceUsd === null ? null : dec(p.proposedPriceUsd),
    currency: p.currency,
    proposedDeliveryDays: p.proposedDeliveryDays,
    compliance: { allowed: compliance.allowed, issues: Array.isArray(compliance.issues) ? compliance.issues : [] },
    approvedAt: iso(p.approvedAt),
    scheduledAt: iso(p.scheduledAt),
    sentAt: iso(p.sentAt),
    failedReason: p.failedReason,
    externalProposalId: p.externalProposalId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    versions: (p.versions ?? []).map((v) => ({
      id: v.id, version: v.version, authorType: v.authorType, changeReason: v.changeReason, length: v.length, tone: v.tone, createdAt: v.createdAt.toISOString(), proposalTranslated: v.proposalTranslated, proposalOriginal: v.proposalOriginal,
    })),
  };
}
