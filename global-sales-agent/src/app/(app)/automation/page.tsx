import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrgSettings, PROPOSAL_LENGTHS, PROPOSAL_TONES } from "@/lib/settings";
import { PLAN_LIMITS } from "@/lib/plans";
import { ACTION_LABELS, type Action, type ActionType } from "@/lib/automation/actions";
import type { Condition } from "@/lib/automation/conditions";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { NewRuleButton, RuleRowActions, type RuleFormData } from "@/components/automation/rule-builder";
import { timeAgo, truncate } from "@/lib/utils";
import { Workflow } from "lucide-react";

export default async function AutomationPage() {
  const user = await requireSession();
  const [rules, runs, org] = await Promise.all([
    prisma.automationRule.findMany({ where: { organizationId: user.orgId }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], include: { _count: { select: { runs: true } } } }),
    prisma.automationRun.findMany({ where: { organizationId: user.orgId }, include: { rule: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    getOrgSettings(user.orgId),
  ]);
  const options = { tones: PROPOSAL_TONES, lengths: PROPOSAL_LENGTHS };
  const limit = PLAN_LIMITS[org.plan].automationRules;
  const atLimit = rules.length >= limit;

  const items = rules.map((r) => {
    const data: RuleFormData & { id: string } = {
      id: r.id,
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      priority: r.priority,
      trigger: r.trigger,
      conditions: (Array.isArray(r.conditions) ? r.conditions : []) as unknown as Condition[],
      actions: (Array.isArray(r.actions) ? r.actions : []) as unknown as Action[],
      stopOnMatch: r.stopOnMatch,
    };
    return { data, runs: r._count.runs, updatedAt: r.updatedAt.toISOString() };
  });

  return (
    <>
      <PageHeader title="Automation" description={`No-code rules: trigger → conditions → actions. ${rules.length}/${limit} rules on the ${org.plan} plan.`} actions={<NewRuleButton options={options} disabled={atLimit} hint={atLimit ? `Plan limit reached (${limit} rules)` : undefined} />} />

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>Evaluated by priority (highest first). Automation level and platform send mode still apply; WON is never set by a rule.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={<Workflow />} title="No rules yet" description="Use “New rule” to create one, e.g. “When a job is analysed and opportunity score ≥ 75, create a proposal”." />
          ) : (
            <Table data-testid="rules-table">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Trigger</TH>
                  <TH className="text-right">Priority</TH>
                  <TH className="text-right">Conditions</TH>
                  <TH>Actions</TH>
                  <TH className="text-right">Runs</TH>
                  <TH className="text-right">Enabled</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(({ data, runs: runCount }) => (
                  <TR key={data.id} data-testid="rule-row">
                    <TD>
                      <p className="font-medium">{data.name}</p>
                      {data.description ? <p className="text-xs text-muted-foreground">{truncate(data.description, 80)}</p> : null}
                    </TD>
                    <TD>
                      <Badge variant="info">{data.trigger.replace(/_/g, " ")}</Badge>
                    </TD>
                    <TD className="text-right tabular-nums">{data.priority}</TD>
                    <TD className="text-right tabular-nums">{data.conditions.length}</TD>
                    <TD>
                      <div className="flex max-w-[320px] flex-wrap gap-1">
                        {data.actions.map((a, i) => (
                          <Badge key={i} variant="outline" title={ACTION_LABELS[a.type as ActionType]}>{a.type.replace(/_/g, " ")}</Badge>
                        ))}
                        {data.stopOnMatch ? <Badge variant="secondary">stop</Badge> : null}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">{runCount}</TD>
                    <TD>
                      <RuleRowActions rule={data} options={options} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>Latest 50 rule evaluations.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No runs yet — rules are evaluated when jobs are analysed, proposals drafted or replies arrive.</p>
          ) : (
            <Table data-testid="runs-table">
              <THead>
                <TR>
                  <TH>Rule</TH>
                  <TH>Trigger</TH>
                  <TH>Entity</TH>
                  <TH>Matched</TH>
                  <TH>Actions executed</TH>
                  <TH className="text-right">Time</TH>
                </TR>
              </THead>
              <TBody>
                {runs.map((run) => {
                  const executed = (Array.isArray(run.actionsExecuted) ? run.actionsExecuted : []) as { type: string; ok: boolean; detail?: string }[];
                  return (
                    <TR key={run.id} data-testid="run-row">
                      <TD className="font-medium">{run.rule.name}</TD>
                      <TD>
                        <Badge variant="info">{run.trigger.replace(/_/g, " ")}</Badge>
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {run.entityType} · <span className="font-mono">{run.entityId.slice(0, 10)}</span>
                      </TD>
                      <TD>{run.matched ? <Badge variant="success">matched</Badge> : <Badge variant="outline">no match</Badge>}</TD>
                      <TD className="text-xs">
                        {run.error ? <span className="text-danger">{run.error}</span> : null}
                        {executed.length === 0 && !run.error ? <span className="text-muted-foreground">—</span> : null}
                        <div className="flex flex-wrap gap-1">
                          {executed.map((a, i) => (
                            <Badge key={i} variant={a.ok ? "success" : "danger"} title={a.detail}>
                              {a.type.replace(/_/g, " ")}
                              {a.detail ? ` · ${truncate(a.detail, 40)}` : ""}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                      <TD className="text-right text-xs text-muted-foreground" title={run.createdAt.toISOString()}>{timeAgo(run.createdAt)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
