import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { listProposals } from "@/lib/services/proposals";
import { listConnectors } from "@/lib/connectors/registry";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { PageHeader, EmptyState, Flag } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ProposalsStatusFilter } from "@/components/proposals/proposals-status-filter";
import { ProposalQuickActions } from "@/components/proposals/proposal-quick-actions";
import { dec, formatCurrency, timeAgo, truncate } from "@/lib/utils";

const STATUSES = ["DRAFT", "AI_REVIEWED", "WAITING_APPROVAL", "APPROVED", "SCHEDULED", "SENT", "FAILED", "REPLIED", "CLOSED"] as const;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === one(sp.status));
  const platformKey = one(sp.platformKey);
  const pageParam = Math.max(1, Number(one(sp.page)) || 1);
  const { items: raw, total, page, pageSize } = await listProposals(user.orgId, { status, platformKey, page: pageParam, pageSize: 25 });
  // Pending approvals float to the top when no status filter is applied.
  const items = status ? raw : [...raw].sort((a, b) => Number(b.status === "WAITING_APPROVAL") - Number(a.status === "WAITING_APPROVAL"));
  const platforms = listConnectors().map((c) => ({ key: c.key, label: c.displayName }));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) => {
    const u = new URLSearchParams();
    if (status) u.set("status", status);
    if (platformKey) u.set("platformKey", platformKey);
    if (p > 1) u.set("page", String(p));
    return `/proposals${u.size ? `?${u.toString()}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Proposals" description={`${total.toLocaleString()} proposal(s)${status ? ` · ${status.replace(/_/g, " ")}` : ""}`} actions={<ProposalsStatusFilter value={status ?? ""} platforms={platforms} />} />

      {items.length === 0 ? (
        <EmptyState icon={<FileText />} title="No proposals" description="Generate a proposal from a qualified job to see it here." action={<Button asChild variant="outline" size="sm"><Link href="/jobs?status=QUALIFIED">Go to jobs</Link></Button>} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table data-testid="proposals-table">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Status</TH>
                <TH>Job</TH>
                <TH>Platform</TH>
                <TH className="text-right">Price</TH>
                <TH>Language</TH>
                <TH>Send mode</TH>
                <TH>Updated</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((p) => {
                const price = p.proposedPrice ? dec(p.proposedPrice) : null;
                const usd = p.proposedPriceUsd ? dec(p.proposedPriceUsd) : null;
                return (
                  <TR key={p.id} data-testid="proposal-row" data-proposal-id={p.id} data-status={p.status}>
                    <TD><StatusBadge status={p.status} /></TD>
                    <TD className="max-w-[360px]">
                      <Link href={`/proposals/${p.id}`} className="block truncate font-medium hover:underline" title={p.job.projectTitle}>
                        {truncate(p.job.projectTitle, 80)}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Flag country={p.job.clientCountry} />
                        <span className="truncate">{p.job.clientName ?? "Unknown client"}</span>
                        {p.job.category ? <span>· {p.job.category}</span> : null}
                        <span>· {p.variantLabel}</span>
                      </div>
                    </TD>
                    <TD className="text-xs">{p.platformKey}</TD>
                    <TD className="text-right tabular-nums">
                      <div className="text-sm">{price !== null ? formatCurrency(price, p.currency) : "—"}</div>
                      {usd !== null && p.currency !== "USD" ? <div className="text-[11px] text-muted-foreground">{formatCurrency(usd, "USD")}</div> : null}
                    </TD>
                    <TD className="text-xs">{LANGUAGE_NAMES[p.detectedLanguage] ?? p.detectedLanguage} <span className="text-muted-foreground">({p.detectedLanguage})</span></TD>
                    <TD><StatusBadge status={p.sendMode} /></TD>
                    <TD className="text-xs text-muted-foreground" title={p.sentAt ? `Sent ${p.sentAt.toISOString()}` : undefined}>
                      {timeAgo(p.updatedAt)}
                      {p.sentAt ? <Badge variant="success" className="ml-2">sent</Badge> : null}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        {p.status === "WAITING_APPROVAL" ? <ProposalQuickActions proposalId={p.id} /> : null}
                        <Button asChild variant="ghost" size="xs">
                          <Link href={`/proposals/${p.id}`}>View</Link>
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="xs" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <Link href={pageHref(page - 1)} aria-disabled={page <= 1}>
                  <ChevronLeft />
                  Prev
                </Link>
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {pages}
              </span>
              <Button asChild variant="ghost" size="xs" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
                <Link href={pageHref(page + 1)} aria-disabled={page >= pages}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
