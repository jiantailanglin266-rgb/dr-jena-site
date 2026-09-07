import Link from "next/link";
import { Handshake } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { listDeals } from "@/lib/services/crm";
import { PageHeader, EmptyState, StatCard, Flag } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, dec, formatCurrency, formatDate, timeAgo } from "@/lib/utils";

export default async function DealsPage() {
  const user = await requireSession();
  const deals = await listDeals(user.orgId);
  const waiting = deals.filter((d) => d.status === "WAITING_HUMAN_APPROVAL");
  const won = deals.filter((d) => d.status === "WON");
  const wonUsd = won.reduce((s, d) => s + dec(d.amountUsd), 0);
  const order = { WAITING_HUMAN_APPROVAL: 0, SUMMARY_DRAFT: 1, WON: 2, LOST: 3 } as const;
  const sorted = [...deals].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <PageHeader title="Deals" description="Deal summaries built by the Closing Agent. Only a human can mark a deal WON." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Awaiting approval" value={waiting.length} hint="Human-in-the-loop" />
        <StatCard label="Won" value={won.length} />
        <StatCard label="Confirmed revenue" value={formatCurrency(wonUsd, "USD")} />
        <StatCard label="Total deals" value={deals.length} />
      </div>

      {deals.length === 0 ? (
        <EmptyState icon={<Handshake />} title="No deals yet" description="Create a Deal Summary from a conversation once the client verbally accepts." />
      ) : (
        <Card>
          <Table data-testid="deals-table">
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Client</TH>
                <TH>Platform</TH>
                <TH className="text-right">Amount</TH>
                <TH className="text-right">USD</TH>
                <TH>Status</TH>
                <TH>Approved by</TH>
                <TH>Won at</TH>
                <TH className="text-right">Updated</TH>
              </TR>
            </THead>
            <TBody>
              {sorted.map((d) => {
                const pending = d.status === "WAITING_HUMAN_APPROVAL";
                return (
                  <TR key={d.id} className={cn(pending && "bg-warning-soft/50 hover:bg-warning-soft")} data-testid="deal-row" data-status={d.status}>
                    <TD>
                      <Link href={`/crm/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                      <p className="max-w-[320px] truncate text-[11px] text-muted-foreground">{d.opportunity.job.projectTitle}</p>
                    </TD>
                    <TD className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <Flag country={d.opportunity.job.clientCountry} />
                        {d.client ? <Link href={`/crm/companies/${d.client.id}`} className="hover:underline">{d.client.name}</Link> : <span className="text-muted-foreground">—</span>}
                      </span>
                    </TD>
                    <TD><Badge variant="outline" className="font-normal">{d.opportunity.job.platformKey}</Badge></TD>
                    <TD className="text-right tabular-nums">{formatCurrency(dec(d.amount), d.currency)}</TD>
                    <TD className="text-right font-medium tabular-nums">{formatCurrency(dec(d.amountUsd), "USD")}</TD>
                    <TD><StatusBadge status={d.status} /></TD>
                    <TD className="text-xs">{d.approvedBy?.name ?? <span className="text-muted-foreground">—</span>}</TD>
                    <TD className="text-xs">{d.wonAt ? formatDate(d.wonAt) : <span className="text-muted-foreground">—</span>}</TD>
                    <TD className="text-right text-xs text-muted-foreground">{timeAgo(d.updatedAt)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
