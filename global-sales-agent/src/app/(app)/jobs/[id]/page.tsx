import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getJob } from "@/lib/services/jobs";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KV, Flag, Separator } from "@/components/ui/misc";
import { AnalysisPanel } from "@/components/jobs/analysis-panel";
import { ExcludeButton } from "@/components/jobs/job-actions";
import { ProposalPanel } from "@/components/proposals/proposal-panel";
import { toProposalView } from "@/components/proposals/proposal-view";
import { dec, formatCurrency, formatDate, formatDateTime, timeAgo } from "@/lib/utils";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const job = await getJob(user.orgId, id);
  if (!job) notFound();

  const budgetMin = job.budgetMin ? dec(job.budgetMin) : null;
  const budgetMax = job.budgetMax ? dec(job.budgetMax) : null;
  const budgetUsd = job.budgetUsd ? dec(job.budgetUsd) : null;
  const rating = job.clientRating ? dec(job.clientRating) : null;
  const budgetLabel = budgetMin !== null && budgetMax !== null && budgetMin !== budgetMax ? `${formatCurrency(budgetMin, job.currency)} – ${formatCurrency(budgetMax, job.currency)}` : budgetMax !== null || budgetMin !== null ? formatCurrency(budgetMax ?? budgetMin, job.currency) : "—";
  const active = job.status !== "EXCLUDED" && job.status !== "ARCHIVED";
  const proposal = job.proposal ? toProposalView(job.proposal) : null;
  const conversationId = job.opportunity?.conversation?.id ?? null;
  const client = job.opportunity?.client ?? null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/jobs" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Jobs
          </Link>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="job-detail-title">{job.projectTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={job.status} />
            <Badge variant="outline">{job.platformKey}</Badge>
            {job.opportunity ? <StatusBadge status={job.opportunity.status} /> : null}
            <span className="flex items-center gap-1">
              <Flag country={job.clientCountry} /> {job.clientName ?? "Unknown client"}
            </span>
            {job.clientLanguage ? <span>· {LANGUAGE_NAMES[job.clientLanguage] ?? job.clientLanguage}</span> : null}
            <span>· posted {timeAgo(job.postedAt ?? job.discoveredAt)}</span>
            {job.jobUrl ? (
              <a href={job.jobUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline">
                Open on platform <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
          {job.excludedReason ? <p className="mt-2 text-xs text-danger">Excluded: {job.excludedReason}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {conversationId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/conversations/${conversationId}`}>Conversation</Link>
            </Button>
          ) : null}
          {active ? <ExcludeButton jobId={job.id} size="sm" variant="outline" /> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Job description</CardTitle>
              <CardDescription>{job.category ?? "Uncategorized"} · {job.projectDescription.length.toLocaleString()} chars</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{job.projectDescription}</div>
              {job.requiredSkills.length ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              ) : null}
              {job.rawText && job.rawText !== job.projectDescription ? (
                <details className="mt-5 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw text from platform</summary>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">{job.rawText}</pre>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Budget & timeline</CardTitle>
              </CardHeader>
              <CardContent className="tabular-nums">
                <KV k="Budget" v={budgetLabel} />
                {budgetUsd !== null && job.currency !== "USD" ? <KV k="≈ USD" v={formatCurrency(budgetUsd, "USD")} /> : null}
                <KV k="Currency" v={job.currency} />
                <KV k="Deadline" v={formatDate(job.deadline)} />
                <KV k="Proposal deadline" v={formatDate(job.proposalDeadline)} />
                <KV k="Competitors" v={job.numberOfCompetitors ?? "—"} />
                <KV k="Posted" v={formatDateTime(job.postedAt)} />
                <KV k="Discovered" v={formatDateTime(job.discoveredAt)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Client</CardTitle>
              </CardHeader>
              <CardContent className="tabular-nums">
                <KV k="Name" v={client ? <Link href={`/crm/companies/${client.id}`} className="hover:underline">{client.name}</Link> : (job.clientName ?? "—")} />
                <KV k="Country" v={<span className="flex items-center gap-1"><Flag country={job.clientCountry} /> {job.clientCountry ?? "—"}</span>} />
                <KV k="Language" v={job.clientLanguage ? `${LANGUAGE_NAMES[job.clientLanguage] ?? job.clientLanguage} (${job.clientLanguage})` : "—"} />
                <KV k="Rating" v={rating !== null ? `${rating.toFixed(1)} / 5` : "—"} />
                <KV k="Payment" v={job.paymentVerified ? <span className="inline-flex items-center gap-1 text-success"><ShieldCheck className="size-3.5" /> Verified</span> : <span className="text-muted-foreground">Unverified</span>} />
                {job.clientHistory ? (
                  <>
                    <Separator className="my-2" />
                    <p className="text-xs leading-relaxed text-muted-foreground">{job.clientHistory}</p>
                  </>
                ) : null}
                <KV k="External job ID" v={<span className="font-mono text-[11px]">{job.externalJobId}</span>} />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-2">
          <AnalysisPanel jobId={job.id} jobStatus={job.status} analysis={job.analysis} currency={job.currency} />
        </div>
      </div>

      <div className="mt-6">
        <ProposalPanel jobId={job.id} proposal={proposal} defaultLanguage={job.clientLanguage ?? job.analysis?.detectedLanguage ?? "en"} conversationId={conversationId} jobStatus={job.status} />
      </div>
    </>
  );
}
