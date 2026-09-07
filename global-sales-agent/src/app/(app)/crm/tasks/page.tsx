import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { listTasks } from "@/lib/services/crm";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TaskStatusButton } from "@/components/crm/task-done";
import { cn, formatDate, timeAgo } from "@/lib/utils";

const STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
type TaskStatusKey = (typeof STATUSES)[number];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const status: TaskStatusKey = STATUSES.includes(sp.status as TaskStatusKey) ? (sp.status as TaskStatusKey) : "OPEN";
  const tasks = await listTasks(user.orgId, status);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Human-in-the-loop items created by agents: approvals, kick-offs, follow-ups."
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs" data-testid="tasks-status-filter">
            {STATUSES.map((s) => (
              <Link key={s} href={s === "OPEN" ? "/crm/tasks" : `/crm/tasks?status=${s}`} className={cn("rounded-md px-3 py-1 font-medium transition-colors", status === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {s === "OPEN" ? "Open" : s === "DONE" ? "Done" : "Cancelled"}
              </Link>
            ))}
          </div>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState icon={<ListChecks />} title={status === "OPEN" ? "No open tasks" : `No ${status.toLowerCase()} tasks`} description={status === "OPEN" ? "You're all caught up." : undefined} />
      ) : (
        <Card>
          <Table data-testid="tasks-table">
            <THead>
              <TR>
                <TH>Task</TH>
                <TH>Opportunity</TH>
                <TH>Assignee</TH>
                <TH>Due</TH>
                <TH>Status</TH>
                <TH className="text-right">Created</TH>
                <TH className="text-right" />
              </TR>
            </THead>
            <TBody>
              {tasks.map((t) => (
                <TR key={t.id} data-testid="task-row">
                  <TD>
                    <p className={cn("font-medium", t.status === "DONE" && "text-muted-foreground line-through")}>{t.title}</p>
                    {t.description ? <p className="mt-0.5 max-w-[420px] truncate text-[11px] text-muted-foreground">{t.description}</p> : null}
                  </TD>
                  <TD className="text-xs">
                    {t.opportunity ? (
                      <span className="flex flex-col gap-0.5">
                        <Link href={t.opportunity.deal ? `/crm/deals/${t.opportunity.deal.id}` : "/pipeline"} className="max-w-[260px] truncate hover:underline">{t.opportunity.title}</Link>
                        <StatusBadge status={t.opportunity.status} className="w-fit" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="text-xs">{t.assignee?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TD>
                  <TD className={cn("text-xs", t.dueAt && t.status === "OPEN" && t.dueAt < new Date() ? "text-danger" : "text-muted-foreground")}>{t.dueAt ? formatDate(t.dueAt) : "—"}</TD>
                  <TD><StatusBadge status={t.status} /></TD>
                  <TD className="text-right text-xs text-muted-foreground">{timeAgo(t.createdAt)}</TD>
                  <TD className="text-right">{t.status !== "CANCELLED" ? <TaskStatusButton id={t.id} status={t.status} /> : null}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
