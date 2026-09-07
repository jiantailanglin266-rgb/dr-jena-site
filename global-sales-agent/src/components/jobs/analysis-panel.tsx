import type { JobAnalysis } from "@prisma/client";
import { BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreRing, ScoreBar, KV, Separator, EmptyState } from "@/components/ui/misc";
import { AnalyzeButton } from "./job-actions";
import { dec, formatCurrency, formatDateTime } from "@/lib/utils";

const ACTION_VARIANT: Record<string, "success" | "warning" | "danger" | "secondary" | "info"> = { APPLY: "success", APPLY_NOW: "success", PROPOSE: "success", CONSIDER: "warning", REVIEW: "info", SKIP: "danger" };

/** Server-renderable analysis panel; the re-analyze button is a client island. */
export function AnalysisPanel({ jobId, jobStatus, analysis, currency }: { jobId: string; jobStatus: string; analysis: JobAnalysis | null; currency: string }) {
  const blocked = jobStatus === "EXCLUDED" || jobStatus === "ARCHIVED";
  if (!analysis) {
    return (
      <Card data-testid="analysis-panel">
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
          <CardDescription>AI Analyst scores the fit, profitability, client quality and risk of this job.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState icon={<BrainCircuit />} title="Not analyzed yet" description="Run the analyst to get scores, deliverables and a recommended action." action={!blocked ? <AnalyzeButton jobId={jobId} label="Analyze job" variant="default" size="sm" /> : undefined} />
        </CardContent>
      </Card>
    );
  }
  const a = analysis;
  const action = a.recommendedAction.toUpperCase();
  return (
    <Card data-testid="analysis-panel">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Analysis</CardTitle>
          <CardDescription>
            {a.estimatedDifficulty} · ~{a.estimatedHours}h · market {formatCurrency(dec(a.estimatedMarketPrice), currency)} · {formatDateTime(a.updatedAt)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing score={a.opportunityScore} size={48} label="Opportunity" />
          {!blocked ? <AnalyzeButton jobId={jobId} label="Re-analyze" variant="outline" size="xs" icon="refresh" testId="job-analyze" /> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Recommended action</span>
          <Badge variant={ACTION_VARIANT[action] ?? "secondary"} data-testid="analysis-recommended-action">{a.recommendedAction.replace(/_/g, " ")}</Badge>
          <Badge variant="outline">lang: {a.detectedLanguage}</Badge>
        </div>

        <div className="flex flex-col gap-2">
          <ScoreBar label="Fit" value={a.fitScore} />
          <ScoreBar label="Profit" value={a.profitScore} />
          <ScoreBar label="Client quality" value={a.clientQualityScore} />
          <ScoreBar label="Win probability" value={a.winProbability} />
          <ScoreBar label="Urgency" value={a.urgencyScore} />
          <ScoreBar label="Competition" value={a.competitionScore} />
          <ScoreBar label="Risk" value={a.riskScore} />
        </div>

        <Separator />

        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Summary</p>
            <p className="leading-relaxed">{a.summary}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Client goal</p>
            <p className="leading-relaxed">{a.clientGoal}</p>
          </div>
          {a.requiredDeliverables.length ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Deliverables</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {a.requiredDeliverables.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          ) : null}
          {a.requiredSkills.length || a.preferredSkills.length ? (
            <div className="flex flex-wrap gap-1.5">
              {a.requiredSkills.map((s) => <Badge key={`r-${s}`} variant="accent">{s}</Badge>)}
              {a.preferredSkills.map((s) => <Badge key={`p-${s}`} variant="outline">{s}</Badge>)}
            </div>
          ) : null}
          {a.riskFlags.length ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Risk flags</p>
              <div className="flex flex-wrap gap-1.5">
                {a.riskFlags.map((f) => <Badge key={f} variant="danger">{f}</Badge>)}
              </div>
            </div>
          ) : null}
        </div>

        <Separator />
        <div>
          <KV k="Estimated hours" v={`${a.estimatedHours}h`} />
          <KV k="Market price" v={formatCurrency(dec(a.estimatedMarketPrice), currency)} />
          <KV k="Difficulty" v={a.estimatedDifficulty} />
        </div>
      </CardContent>
    </Card>
  );
}
