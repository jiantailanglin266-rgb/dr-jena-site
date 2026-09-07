import { describe, expect, it } from "vitest";
import { evaluateConditions, conditionSchema } from "@/lib/automation/conditions";

const ctx = { job: { budgetUsd: 2500, clientRating: 4.8, category: "AI", requiredSkills: ["Next.js", "RAG"], paymentVerified: true }, analysis: { fitScore: 90, riskScore: 10, riskFlags: ["vague_requirements"] }, reply: { category: "PRICE_NEGOTIATION" } };

describe("Automation conditions", () => {
  it("evaluates the canonical high-fit rule", () => {
    const conds = [
      { field: "analysis.fitScore", op: "gt", value: 85 },
      { field: "job.budgetUsd", op: "gt", value: 1000 },
      { field: "job.clientRating", op: "gt", value: 4.5 },
      { field: "analysis.riskScore", op: "lt", value: 20 },
    ] as const;
    expect(evaluateConditions([...conds], ctx)).toBe(true);
    expect(evaluateConditions([{ field: "analysis.riskScore", op: "lt", value: 5 }], ctx)).toBe(false);
  });
  it("supports in / contains / exists / any / all", () => {
    expect(evaluateConditions([{ field: "reply.category", op: "in", value: ["PRICE_NEGOTIATION", "QUESTION"] }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: "job.requiredSkills", op: "contains", value: "rag" }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: "analysis.riskFlags", op: "not_contains", value: "vague_requirements" }], ctx)).toBe(false);
    expect(evaluateConditions([{ field: "job.deadline", op: "exists" }], ctx)).toBe(false);
    expect(evaluateConditions([{ any: [{ field: "job.category", op: "eq", value: "Design" }, { field: "job.category", op: "eq", value: "AI" }] }], ctx)).toBe(true);
    expect(evaluateConditions([{ all: [{ field: "job.paymentVerified", op: "eq", value: true }, { field: "job.category", op: "neq", value: "AI" }] }], ctx)).toBe(false);
  });
  it("missing fields never match and schema validates shape", () => {
    expect(evaluateConditions([{ field: "job.nope.deep", op: "gt", value: 1 }], ctx)).toBe(false);
    expect(conditionSchema.safeParse({ field: "x", op: "gt", value: 1 }).success).toBe(true);
    expect(conditionSchema.safeParse({ field: "x", op: "between", value: 1 }).success).toBe(false);
  });
});
