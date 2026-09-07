import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getProposal } from "@/lib/services/proposals";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { KV, Flag, ScoreRing } from "@/components/ui/misc";
import { ProposalPanel } from "@/components/proposals/proposal-panel";
import { toProposalView } from "@/components/proposals/proposal-view";
import { dec, formatCurrency, formatDate, timeAgo } from "@/lib/utils";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const p = await getProposal(user.orgId, id);
  if (!p) notFound();

  const job = p.job;
  const budget = job.budgetMax ? dec(job.budgetMax) : job.budgetMin ? dec(job.budgetMin) : null;
  const budgetUsd = job.budgetUsd ? dec(job.budgetUsd) : null;
  const rating = job.clientRating ? dec(job.clientRating) : null;
  const conversationId = p.opportunity.conversation?.id ?? null;
  const client = p.opportunity.client;

  return (
    <>
      <div className="mb-6">
        <Link href="/proposals" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Proposals
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{job.projectTitle}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={p.opportunity.status} />
          <Badge variant="outline">{p.platformKey}</Badge>
          <span className="flex items-center gap-1">
            <Flag country={job.clientCountry} /> {job.clientName ?? "Unknown client"}
          </span>
          <span>· proposal created {timeAgo(p.createdAt)}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Job</CardTitle>
              <CardDescription>{job.category ?? "Uncategorized"}</CardDescription>
            </div>
            {job.analysis ? <ScoreRing score={job.analysis.opportunityScore} size={40} /> : null}
          </CardHeader>
          <CardContent className="tabular-nums">
            <KV k="Status" v={<StatusBadge status={job.status} />} />
            <KV k="Budget" v={budget !== null ? formatCurrency(budget, job.currency) : "—"} />
            {budgetUsd !== null && job.currency !== "USD" ? <KV k="≈ USD" v={formatCurrency(budgetUsd, "USD")} /> : null}
            <KV k="Deadline" v={formatDate(job.deadline)} />
            <KV k="Competitors" v={job.numberOfCompetitors ?? "—"} />
            <KV k="Client" v={client ? <Link href={`/crm/companies/${client.id}`} className="hover:underline">{client.name}</Link> : (job.clientName ?? "—")} />
            <KV k="Language" v={job.clientLanguage ? `${LANGUAGE_NAMES[job.clientLanguage] ?? job.clientLanguage} (${job.clientLanguage})` : "—"} />
            <KV k="Rating" v={rating !== null ? `${rating.toFixed(1)} / 5` : "—"} />
            {job.analysis ? <KV k="Recommended" v={job.analysis.recommendedAction.replace(/_/g, " ")} /> : null}
            <div className="mt-3 flex flex-col gap-1.5 text-xs">
              <Link href={`/jobs/${job.id}`} className="text-accent underline-offset-2 hover:underline">Open job detail →</Link>
              {job.jobUrl ? (
                <a href={job.jobUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Open on platform <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
            {job.analysis ? <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{job.analysis.summary}</p> : null}
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <ProposalPanel jobId={job.id} proposal={toProposalView(p)} defaultLanguage={job.clientLanguage ?? p.detectedLanguage} conversationId={conversationId} jobStatus={job.status} />
        </div>
      </div>
    </>
  );
}
