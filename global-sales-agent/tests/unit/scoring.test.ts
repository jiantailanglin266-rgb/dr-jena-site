import { describe, expect, it } from "vitest";
import { computeOpportunityScore, scoreLabel } from "@/lib/scoring/opportunity";

describe("Opportunity Score", () => {
  it("weights fit/profit/quality/win/urgency and subtracts risk", () => {
    const high = computeOpportunityScore({ fit_score: 95, profit_score: 90, client_quality_score: 90, win_probability: 80, urgency_score: 50, risk_score: 5, competition_score: 20 });
    const low = computeOpportunityScore({ fit_score: 20, profit_score: 10, client_quality_score: 30, win_probability: 10, urgency_score: 10, risk_score: 80, competition_score: 90 });
    expect(high.opportunityScore).toBeGreaterThan(80);
    expect(low.opportunityScore).toBeLessThan(20);
    expect(scoreLabel(high.opportunityScore)).toBe("EXCELLENT");
    expect(scoreLabel(low.opportunityScore)).toBe("POOR");
  });
  it("clamps to 0–100", () => {
    const s = computeOpportunityScore({ fit_score: 0, profit_score: 0, client_quality_score: 0, win_probability: 0, urgency_score: 0, risk_score: 100, competition_score: 100 });
    expect(s.opportunityScore).toBe(0);
  });
});
