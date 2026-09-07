import type { JobAnalysisOutput } from "../agents/schemas";

export interface ScoreBreakdown {
  fitScore: number;
  profitScore: number;
  clientQualityScore: number;
  winProbability: number;
  urgencyScore: number;
  riskScore: number;
  competitionScore: number;
  opportunityScore: number;
}

export const SCORE_WEIGHTS = { fit: 0.3, profit: 0.2, clientQuality: 0.15, win: 0.2, urgency: 0.05, risk: 0.1 } as const;

/**
 * Opportunity Score (0–100):
 *   0.30·Fit + 0.20·Profit + 0.15·ClientQuality + 0.20·WinProbability + 0.05·Urgency − 0.10·Risk (normalised)
 * Risk is subtracted, then the sum is rescaled to 0–100.
 */
export function computeOpportunityScore(a: Pick<JobAnalysisOutput, "fit_score" | "profit_score" | "client_quality_score" | "win_probability" | "urgency_score" | "risk_score" | "competition_score">): ScoreBreakdown {
  const w = SCORE_WEIGHTS;
  const positive = a.fit_score * w.fit + a.profit_score * w.profit + a.client_quality_score * w.clientQuality + a.win_probability * w.win + a.urgency_score * w.urgency;
  const maxPositive = 100 * (w.fit + w.profit + w.clientQuality + w.win + w.urgency);
  const penalty = a.risk_score * w.risk;
  const raw = (positive - penalty) / maxPositive;
  const opportunityScore = Math.round(Math.max(0, Math.min(1, raw)) * 100);
  return {
    fitScore: a.fit_score,
    profitScore: a.profit_score,
    clientQualityScore: a.client_quality_score,
    winProbability: a.win_probability,
    urgencyScore: a.urgency_score,
    riskScore: a.risk_score,
    competitionScore: a.competition_score,
    opportunityScore,
  };
}

export function scoreLabel(score: number): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
  if (score >= 80) return "EXCELLENT";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "FAIR";
  return "POOR";
}
