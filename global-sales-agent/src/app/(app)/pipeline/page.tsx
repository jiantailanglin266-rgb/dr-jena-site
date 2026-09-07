import { requireSession } from "@/lib/auth";
import { listOpportunities } from "@/lib/services/crm";
import { PageHeader } from "@/components/ui/misc";
import { KanbanBoard, LEAD_STATUSES, type KanbanItem } from "@/components/pipeline/kanban";
import { dec, formatCurrency } from "@/lib/utils";

export default async function PipelinePage() {
  const user = await requireSession();
  const opportunities = await listOpportunities(user.orgId);
  const items: KanbanItem[] = opportunities.map((o) => ({
    id: o.id,
    jobId: o.jobId,
    title: o.title || o.job.projectTitle,
    status: o.status,
    clientName: o.job.clientName,
    clientCountry: o.job.clientCountry,
    platformKey: o.job.platformKey,
    category: o.job.category,
    score: o.job.analysis?.opportunityScore ?? null,
    valueUsd: o.estimatedValueUsd !== null ? dec(o.estimatedValueUsd) : null,
    stageChangedAt: o.stageChangedAt.toISOString(),
    conversationId: o.conversation?.id ?? null,
    dealId: o.deal?.id ?? null,
  }));
  const open = items.filter((i) => i.status !== "WON" && i.status !== "LOST");
  const openValue = open.reduce((s, i) => s + (i.valueUsd ?? 0), 0);
  const won = items.filter((i) => i.status === "WON");
  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${open.length} open · ${formatCurrency(openValue, "USD")} in play · ${won.length} won · ${LEAD_STATUSES.length} stages`}
      />
      <KanbanBoard items={items} />
    </>
  );
}
