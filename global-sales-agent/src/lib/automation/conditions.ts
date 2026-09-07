import { z } from "zod";

export const conditionOps = ["gt", "gte", "lt", "lte", "eq", "neq", "in", "not_in", "contains", "not_contains", "exists"] as const;
export type ConditionOp = (typeof conditionOps)[number];

export type Condition = { field: string; op: ConditionOp; value?: unknown } | { any: Condition[] } | { all: Condition[] };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ field: z.string().min(1), op: z.enum(conditionOps), value: z.unknown().optional() }),
    z.object({ any: z.array(conditionSchema) }),
    z.object({ all: z.array(conditionSchema) }),
  ]),
);

export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc !== null && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  if (v && typeof v === "object" && "toNumber" in v) return (v as { toNumber: () => number }).toNumber();
  return null;
}

export function evaluateCondition(cond: Condition, ctx: unknown): boolean {
  if ("any" in cond) return cond.any.length === 0 ? true : cond.any.some((c) => evaluateCondition(c, ctx));
  if ("all" in cond) return cond.all.every((c) => evaluateCondition(c, ctx));
  const actual = getByPath(ctx, cond.field);
  const { op, value } = cond;
  switch (op) {
    case "exists":
      return actual !== undefined && actual !== null;
    case "eq":
      return actual === value || String(actual) === String(value);
    case "neq":
      return !(actual === value || String(actual) === String(value));
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = toNum(actual);
      const b = toNum(value);
      if (a === null || b === null) return false;
      return op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b;
    }
    case "in":
      return Array.isArray(value) && value.map(String).includes(String(actual));
    case "not_in":
      return Array.isArray(value) && !value.map(String).includes(String(actual));
    case "contains":
      if (Array.isArray(actual)) return actual.map((x) => String(x).toLowerCase()).includes(String(value).toLowerCase());
      return typeof actual === "string" && actual.toLowerCase().includes(String(value).toLowerCase());
    case "not_contains":
      if (Array.isArray(actual)) return !actual.map((x) => String(x).toLowerCase()).includes(String(value).toLowerCase());
      return !(typeof actual === "string" && actual.toLowerCase().includes(String(value).toLowerCase()));
    default:
      return false;
  }
}

export function evaluateConditions(conds: Condition[], ctx: unknown): boolean {
  return conds.every((c) => evaluateCondition(c, ctx));
}

/** Fields offered by the no-code builder */
export const CONDITION_FIELDS: { field: string; label: string; type: "number" | "string" | "boolean" | "enum"; options?: string[] }[] = [
  { field: "analysis.fitScore", label: "Fit Score", type: "number" },
  { field: "analysis.profitScore", label: "Profit Score", type: "number" },
  { field: "analysis.clientQualityScore", label: "Client Quality Score", type: "number" },
  { field: "analysis.winProbability", label: "Win Probability", type: "number" },
  { field: "analysis.urgencyScore", label: "Urgency Score", type: "number" },
  { field: "analysis.riskScore", label: "Risk Score", type: "number" },
  { field: "analysis.opportunityScore", label: "Opportunity Score", type: "number" },
  { field: "analysis.estimatedHours", label: "Estimated Hours", type: "number" },
  { field: "analysis.riskFlags", label: "Risk Flags (contains)", type: "string" },
  { field: "job.budgetUsd", label: "Budget (USD)", type: "number" },
  { field: "job.clientRating", label: "Client Rating", type: "number" },
  { field: "job.paymentVerified", label: "Payment Verified", type: "boolean" },
  { field: "job.competitors", label: "Competitors", type: "number" },
  { field: "job.category", label: "Category", type: "string" },
  { field: "job.clientCountry", label: "Client Country", type: "string" },
  { field: "job.clientLanguage", label: "Client Language", type: "string" },
  { field: "job.platformKey", label: "Platform", type: "string" },
  { field: "reply.category", label: "Reply Category", type: "enum", options: ["INTERESTED", "QUESTION", "PRICE_NEGOTIATION", "SCHEDULE_NEGOTIATION", "TECHNICAL_QUESTION", "REQUEST_PORTFOLIO", "REQUEST_MEETING", "OBJECTION", "REJECTION", "ACCEPTANCE", "UNKNOWN"] },
  { field: "reply.sentiment", label: "Reply Sentiment", type: "enum", options: ["POSITIVE", "NEUTRAL", "NEGATIVE"] },
  { field: "reply.purchaseProbability", label: "Purchase Probability", type: "number" },
  { field: "reply.urgency", label: "Reply Urgency", type: "number" },
  { field: "opportunity.status", label: "Lead Status", type: "string" },
  { field: "proposal.sendMode", label: "Proposal Send Mode", type: "enum", options: ["AUTO", "MANUAL_APPROVAL", "MANUAL_ONLY"] },
  { field: "org.automationLevel", label: "Automation Level", type: "enum", options: ["MANUAL", "ASSISTED", "SEMI_AUTO", "FULL_AUTO"] },
];
