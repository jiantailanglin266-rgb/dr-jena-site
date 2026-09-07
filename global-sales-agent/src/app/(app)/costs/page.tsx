import { requireSession } from "@/lib/auth";
import { getAiCosts } from "@/lib/services/analytics";
import { getOrgSettings } from "@/lib/settings";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dec, formatNumber, timeAgo } from "@/lib/utils";
import { Coins, CalendarDays, Sigma, Cpu } from "lucide-react";

const usd = (n: number, digits = 2) => `$${n.toFixed(digits)}`;

export default async function CostsPage() {
  const user = await requireSession();
  const [costs, org] = await Promise.all([getAiCosts(user.orgId), getOrgSettings(user.orgId)]);
  const { settings } = org;
  const dailyPct = settings.aiDailyCostLimitUsd ? (costs.dailyCostUsd / settings.aiDailyCostLimitUsd) * 100 : 0;
  const monthlyPct = settings.aiMonthlyCostLimitUsd ? (costs.monthlyCostUsd / settings.aiMonthlyCostLimitUsd) * 100 : 0;

  return (
    <>
      <PageHeader title="AI Costs" description="Token usage and spend per agent. Limits are enforced from Settings → AI & Automation." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div data-testid="costs-daily">
          <StatCard label="Today" value={usd(costs.dailyCostUsd, 4)} hint={`${costs.dailyRuns} runs · limit ${usd(settings.aiDailyCostLimitUsd)} (${dailyPct.toFixed(0)}%)`} icon={<CalendarDays />} />
        </div>
        <div data-testid="costs-monthly">
          <StatCard label="This month" value={usd(costs.monthlyCostUsd, 4)} hint={`${costs.monthlyRuns} runs · limit ${usd(settings.aiMonthlyCostLimitUsd)} (${monthlyPct.toFixed(0)}%)`} icon={<Coins />} />
        </div>
        <StatCard label="Total" value={usd(costs.totalCostUsd, 4)} hint={`${costs.totalRuns} runs all time`} icon={<Sigma />} />
        <StatCard label="Tokens this month" value={formatNumber(costs.tokens.monthIn + costs.tokens.monthOut)} hint={`in ${formatNumber(costs.tokens.monthIn)} · out ${formatNumber(costs.tokens.monthOut)} · today ${formatNumber(costs.tokens.dayIn + costs.tokens.dayOut)}`} icon={<Cpu />} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Cost per lead" value={usd(costs.costPerLead, 4)} hint="total cost / qualified jobs" />
        <StatCard label="Cost per proposal" value={usd(costs.costPerProposal, 4)} hint="total cost / proposals" />
        <StatCard label="Cost per reply" value={usd(costs.costPerReply, 4)} hint="total cost / AI replies" />
        <StatCard label="Cost per won deal" value={usd(costs.costPerWonDeal, 2)} hint="total cost / WON deals" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By agent</CardTitle>
            <CardDescription>All-time spend per agent</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="costs-by-agent">
              <THead>
                <TR>
                  <TH>Agent</TH>
                  <TH className="text-right">Runs</TH>
                  <TH className="text-right">Tokens</TH>
                  <TH className="text-right">Cost</TH>
                </TR>
              </THead>
              <TBody>
                {costs.byAgent.length === 0 ? (
                  <TR>
                    <TD colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No AI runs yet</TD>
                  </TR>
                ) : null}
                {costs.byAgent.map((a) => (
                  <TR key={a.agent} data-testid="costs-agent-row">
                    <TD className="font-medium capitalize">{a.agent}</TD>
                    <TD className="text-right tabular-nums">{a.runs}</TD>
                    <TD className="text-right text-xs tabular-nums text-muted-foreground">{formatNumber(a.inputTokens)} / {formatNumber(a.outputTokens)}</TD>
                    <TD className="text-right tabular-nums">{usd(a.costUsd, 4)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Latest 50 model calls</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="costs-recent">
              <THead>
                <TR>
                  <TH>Agent</TH>
                  <TH>Purpose</TH>
                  <TH>Provider / model</TH>
                  <TH className="text-right">In / out</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Latency</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Time</TH>
                </TR>
              </THead>
              <TBody>
                {costs.recent.length === 0 ? (
                  <TR>
                    <TD colSpan={8} className="py-6 text-center text-xs text-muted-foreground">No AI runs yet</TD>
                  </TR>
                ) : null}
                {costs.recent.map((r) => (
                  <TR key={r.id} data-testid="costs-run-row">
                    <TD className="font-medium capitalize">{r.agent}</TD>
                    <TD className="text-xs text-muted-foreground">{r.purpose}</TD>
                    <TD className="text-xs">
                      <span className="text-muted-foreground">{r.provider}</span> · {r.model}
                    </TD>
                    <TD className="text-right text-xs tabular-nums">{formatNumber(r.inputTokens)} / {formatNumber(r.outputTokens)}</TD>
                    <TD className="text-right tabular-nums">{usd(dec(r.costUsd), 6)}</TD>
                    <TD className="text-right text-xs tabular-nums text-muted-foreground">{formatNumber(r.latencyMs)} ms</TD>
                    <TD>{r.success ? <Badge variant="success">ok</Badge> : <Badge variant="danger" title={r.error ?? undefined}>failed</Badge>}</TD>
                    <TD className="text-right text-xs text-muted-foreground" title={r.createdAt.toISOString()}>{timeAgo(r.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
