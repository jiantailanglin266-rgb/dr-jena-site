import { requireSession } from "@/lib/auth";
import { getFunnel, getDailySeries, byPlatform, byCountry, byLanguage, byCategory, getAbTestReport } from "@/lib/services/analytics";
import { getMemoryInsights } from "@/lib/services/memory";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendChart, FunnelChart } from "@/components/charts";
import { BreakdownTable, AbTable } from "@/components/analytics/tables";
import { formatPct } from "@/lib/utils";
import { Brain } from "lucide-react";

export default async function AnalyticsPage() {
  const user = await requireSession();
  const [funnel, series, platform, country, language, category, ab, memory] = await Promise.all([
    getFunnel(user.orgId),
    getDailySeries(user.orgId, 30),
    byPlatform(user.orgId),
    byCountry(user.orgId),
    byLanguage(user.orgId),
    byCategory(user.orgId),
    getAbTestReport(user.orgId),
    getMemoryInsights(user.orgId),
  ]);

  const abSections: { key: string; title: string; rows: typeof ab.variants }[] = [
    { key: "variants", title: "Variants", rows: ab.variants },
    { key: "openings", title: "Opening style", rows: ab.openings },
    { key: "lengths", title: "Length", rows: ab.lengths },
    { key: "tones", title: "Tone", rows: ab.tones },
    { key: "ctas", title: "CTA type", rows: ab.ctas },
    { key: "pricePositions", title: "Price position", rows: ab.pricePositions },
    { key: "portfolio", title: "Portfolio included", rows: ab.portfolio },
    { key: "languages", title: "Language", rows: ab.languages.map((r) => ({ ...r, value: LANGUAGE_NAMES[r.value] ?? r.value })) },
  ];

  return (
    <>
      <PageHeader title="Analytics" description="Funnel, 30-day trend, breakdowns and what the Performance Memory has learned." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>30-day trend</CardTitle>
            <CardDescription>Discovered · Sent · Replies · Won</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={series}
              height={260}
              series={[
                { key: "discovered", label: "Discovered", color: "#a1a1aa" },
                { key: "sent", label: "Sent", color: "#6366f1" },
                { key: "replies", label: "Replies", color: "#14b8a6" },
                { key: "won", label: "Won", color: "#22c55e" },
              ]}
            />
          </CardContent>
        </Card>
        <Card data-testid="analytics-funnel">
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
            <CardDescription>Conversion between stages</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelChart stages={funnel} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By platform</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={platform} dim="platform" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By country</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={country} dim="country" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By language</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={language} dim="language" labelFor={(k) => LANGUAGE_NAMES[k] ?? k} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={category} dim="category" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6" data-testid="analytics-ab">
        <CardHeader>
          <CardTitle>A/B testing</CardTitle>
          <CardDescription>Reply and win rates by proposal feature · {ab.sampleSize} sent proposals in the sample</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {abSections.map((s) => (
              <AbTable key={s.key} title={s.title} rows={s.rows} testId={`analytics-ab-${s.key}`} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6" data-testid="analytics-memory">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-accent" /> Performance Memory
          </CardTitle>
          <CardDescription>Insights injected into the Proposal Agent prompt so future proposals reuse what worked.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Sample size" value={memory.sampleSize} hint="sent proposals with recorded features" />
            <StatCard label="Reply rate" value={formatPct(memory.replyRate * 100)} />
            <StatCard label="Win rate" value={formatPct(memory.winRate * 100)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {memory.bestOpening ? <Badge variant="accent">Opening: {memory.bestOpening}</Badge> : null}
            {memory.bestCta ? <Badge variant="accent">CTA: {memory.bestCta}</Badge> : null}
            {memory.bestTone ? <Badge variant="accent">Tone: {memory.bestTone}</Badge> : null}
            {memory.bestLength ? <Badge variant="accent">Length: {memory.bestLength}</Badge> : null}
            {memory.bestPricePosition ? <Badge variant="accent">Price: {memory.bestPricePosition}</Badge> : null}
          </div>
          <ul className="mt-4 flex flex-col gap-1.5 text-sm">
            {memory.notes.map((n, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
