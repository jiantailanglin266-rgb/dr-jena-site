import Link from "next/link";
import { Briefcase, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { listJobs, type JobFilters } from "@/lib/services/jobs";
import { listConnectors } from "@/lib/connectors/registry";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { PageHeader, EmptyState, ScoreRing, Flag } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { JobsFilters, type JobsQuery } from "@/components/jobs/jobs-filters";
import { AnalyzeAllButton, RunDiscoveryButton, ImportJobsDialog } from "@/components/jobs/jobs-header-actions";
import { JobRowActions } from "@/components/jobs/job-actions";
import { dec, formatCurrency, timeAgo, truncate } from "@/lib/utils";

const JOB_STATUSES = ["NEW", "ANALYZED", "QUALIFIED", "EXCLUDED", "ARCHIVED"] as const;
const SORTS = ["score", "posted", "budget"] as const;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const query: JobsQuery = {
    status: one(sp.status), platformKey: one(sp.platformKey), category: one(sp.category), country: one(sp.country), q: one(sp.q), minScore: one(sp.minScore), sort: one(sp.sort), page: one(sp.page),
  };
  const status = JOB_STATUSES.find((s) => s === query.status);
  const sort = SORTS.find((s) => s === query.sort);
  const minScore = Number(query.minScore);
  const filters: JobFilters = {
    status, platformKey: query.platformKey, category: query.category, country: query.country?.toUpperCase(), q: query.q,
    minScore: Number.isFinite(minScore) && minScore > 0 ? minScore : undefined,
    page: Math.max(1, Number(query.page) || 1), pageSize: 25, sort,
  };
  const { items, total, page, pageSize } = await listJobs(user.orgId, filters);
  const platforms = listConnectors().map((c) => ({ key: c.key, label: c.displayName }));
  const newIds = items.filter((j) => j.status === "NEW").map((j) => j.id);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const pageHref = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") u.set(k, v);
    if (p > 1) u.set("page", String(p));
    return `/jobs${u.size ? `?${u.toString()}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Jobs"
        description={`${total.toLocaleString()} job(s)${status ? ` · ${status}` : ""}`}
        actions={
          <>
            <ImportJobsDialog />
            <AnalyzeAllButton jobIds={newIds} />
            <RunDiscoveryButton />
          </>
        }
      />

      <JobsFilters initial={query} platforms={platforms} />

      {items.length === 0 ? (
        <EmptyState icon={<Briefcase />} title="No jobs match" description="Run discovery on your connected platforms or import jobs manually to get started." action={<RunDiscoveryButton />} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table data-testid="jobs-table">
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16">Score</TH>
                <TH>Title</TH>
                <TH>Category</TH>
                <TH className="text-right">Budget</TH>
                <TH className="text-right">Comp.</TH>
                <TH className="text-right">Rating</TH>
                <TH>Posted</TH>
                <TH>Status</TH>
                <TH>Proposal</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((j) => {
                const budgetMax = j.budgetMax ? dec(j.budgetMax) : j.budgetMin ? dec(j.budgetMin) : null;
                const budgetUsd = j.budgetUsd ? dec(j.budgetUsd) : null;
                const rating = j.clientRating ? dec(j.clientRating) : null;
                return (
                  <TR key={j.id} data-testid="job-row" data-job-id={j.id} data-status={j.status}>
                    <TD>
                      {j.analysis ? <ScoreRing score={j.analysis.opportunityScore} size={40} /> : <span className="inline-flex size-10 items-center justify-center rounded-full border border-dashed border-border text-[11px] text-muted-foreground">—</span>}
                    </TD>
                    <TD className="max-w-[360px]">
                      <Link href={`/jobs/${j.id}`} className="block truncate font-medium hover:underline" title={j.projectTitle}>
                        {truncate(j.projectTitle, 80)}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Flag country={j.clientCountry} />
                        <span className="truncate">{j.clientName ?? "Unknown client"}</span>
                        {j.clientLanguage ? <span>· {LANGUAGE_NAMES[j.clientLanguage] ?? j.clientLanguage}</span> : null}
                        <span>· {j.platformKey}</span>
                        {j.jobUrl ? (
                          <a href={j.jobUrl} target="_blank" rel="noreferrer" className="hover:text-foreground" title="Open on platform">
                            <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="text-xs text-muted-foreground">{j.category ?? "—"}</TD>
                    <TD className="text-right tabular-nums">
                      <div className="text-sm">{budgetMax !== null ? formatCurrency(budgetMax, j.currency) : "—"}</div>
                      {budgetUsd !== null && j.currency !== "USD" ? <div className="text-[11px] text-muted-foreground">{formatCurrency(budgetUsd, "USD")}</div> : null}
                    </TD>
                    <TD className="text-right tabular-nums text-xs">{j.numberOfCompetitors ?? "—"}</TD>
                    <TD className="text-right tabular-nums text-xs">{rating !== null ? rating.toFixed(1) : "—"}</TD>
                    <TD className="text-xs text-muted-foreground">{timeAgo(j.postedAt ?? j.discoveredAt)}</TD>
                    <TD><StatusBadge status={j.status} /></TD>
                    <TD>{j.proposal ? <Link href={`/proposals/${j.proposal.id}`}><StatusBadge status={j.proposal.status} /></Link> : <Badge variant="outline" className="text-muted-foreground">none</Badge>}</TD>
                    <TD><JobRowActions jobId={j.id} status={j.status} hasProposal={!!j.proposal} /></TD>
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
