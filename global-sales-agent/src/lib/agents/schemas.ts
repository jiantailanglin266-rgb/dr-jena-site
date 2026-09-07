import { z } from "zod";

export const jobAnalysisSchema = z.object({
  summary: z.string(),
  client_goal: z.string(),
  required_deliverables: z.array(z.string()).default([]),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  estimated_difficulty: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]).default("MEDIUM"),
  estimated_hours: z.number().min(0).default(0),
  estimated_market_price: z.number().min(0).default(0),
  urgency_score: z.number().min(0).max(100).default(50),
  client_quality_score: z.number().min(0).max(100).default(50),
  competition_score: z.number().min(0).max(100).default(50),
  win_probability: z.number().min(0).max(100).default(30),
  risk_flags: z.array(z.string()).default([]),
  recommended_action: z.enum(["PROPOSE", "PROPOSE_WITH_CAUTION", "REVIEW", "SKIP"]).default("REVIEW"),
  fit_score: z.number().min(0).max(100).default(50),
  profit_score: z.number().min(0).max(100).default(50),
  risk_score: z.number().min(0).max(100).default(30),
  detected_language: z.string().default("en"),
});
export type JobAnalysisOutput = z.infer<typeof jobAnalysisSchema>;

export const proposalSectionsSchema = z.object({
  understanding: z.string(),
  solution: z.string(),
  approach: z.string(),
  similar_experience: z.string(),
  timeline: z.string(),
  delivery: z.string(),
  pricing: z.string(),
  risks: z.string(),
  next_action: z.string(),
  closing: z.string(),
});

export const proposalSchema = z.object({
  language: z.string(),
  subject: z.string().default(""),
  sections: proposalSectionsSchema,
  proposed_price: z.number().min(0),
  currency: z.string().default("USD"),
  delivery_days: z.number().min(1).default(14),
  opening_style: z.string().default("empathetic"),
  cta_type: z.string().default("call"),
  has_portfolio: z.boolean().default(false),
});
export type ProposalOutput = z.infer<typeof proposalSchema>;

export const REPLY_CATEGORIES = [
  "INTERESTED", "QUESTION", "PRICE_NEGOTIATION", "SCHEDULE_NEGOTIATION", "TECHNICAL_QUESTION", "REQUEST_PORTFOLIO",
  "REQUEST_MEETING", "OBJECTION", "REJECTION", "ACCEPTANCE", "UNKNOWN",
] as const;

export const replyAnalysisSchema = z.object({
  category: z.enum(REPLY_CATEGORIES).default("UNKNOWN"),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).default("NEUTRAL"),
  intent: z.string().default(""),
  purchase_probability: z.number().min(0).max(100).default(30),
  urgency: z.number().min(0).max(100).default(30),
  next_best_action: z.string().default(""),
  summary: z.string().default(""),
  detected_language: z.string().default("en"),
  extracted: z
    .object({
      proposed_price: z.number().nullable().default(null),
      currency: z.string().nullable().default(null),
      requested_deadline: z.string().nullable().default(null),
      questions: z.array(z.string()).default([]),
    })
    .default({ proposed_price: null, currency: null, requested_deadline: null, questions: [] }),
});
export type ReplyAnalysisOutput = z.infer<typeof replyAnalysisSchema>;

export const replyDraftSchema = z.object({
  language: z.string(),
  body: z.string(),
  includes: z.array(z.string()).default([]),
  suggested_next_status: z.string().nullable().default(null),
});
export type ReplyDraftOutput = z.infer<typeof replyDraftSchema>;

export const NEGOTIATION_STRATEGIES = ["HOLD", "DISCOUNT", "SCOPE_REDUCTION", "SPLIT_DELIVERY", "ADD_OPTION", "MAINTENANCE_CONTRACT", "DECLINE"] as const;

export const negotiationSchema = z.object({
  strategy: z.enum(NEGOTIATION_STRATEGIES),
  offer_price: z.number().min(0),
  currency: z.string().default("USD"),
  discount_pct: z.number().min(0).max(100).default(0),
  scope_changes: z.array(z.string()).default([]),
  rationale: z.string().default(""),
  language: z.string(),
  body: z.string(),
});
export type NegotiationOutput = z.infer<typeof negotiationSchema>;

export const dealSummarySchema = z.object({
  price: z.number().nullable().default(null),
  currency: z.string().default("USD"),
  delivery: z.string().nullable().default(null),
  scope: z.string().nullable().default(null),
  deliverables: z.array(z.string()).default([]),
  revision_rounds: z.number().nullable().default(null),
  payment_terms: z.string().nullable().default(null),
  ip_rights: z.string().nullable().default(null),
  maintenance: z.string().nullable().default(null),
  contract_method: z.string().nullable().default(null),
  unresolved: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(100).default(50),
  narrative: z.string().default(""),
});
export type DealSummaryOutput = z.infer<typeof dealSummarySchema>;

export const complianceSchema = z.object({
  allowed: z.boolean(),
  issues: z.array(z.object({ code: z.string(), severity: z.enum(["INFO", "WARN", "BLOCK"]), message: z.string() })).default([]),
});
export type ComplianceOutput = z.infer<typeof complianceSchema>;

export const translationSchema = z.object({
  translated: z.string(),
  source_language: z.string(),
  target_language: z.string(),
});
