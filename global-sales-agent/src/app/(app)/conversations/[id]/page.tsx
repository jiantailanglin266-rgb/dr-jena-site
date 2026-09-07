import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { buildThreadContext } from "@/lib/agents/thread";
import { getOrgSettings, LANGUAGE_NAMES } from "@/lib/settings";
import { PageHeader, KV, Flag, Separator } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThreadPanel, type ThreadMessage } from "@/components/conversations/thread";
import { formatCurrency, formatDate, formatDateTime, formatPct } from "@/lib/utils";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const [thread, org] = await Promise.all([
    buildThreadContext(user.orgId, id).catch(() => null),
    getOrgSettings(user.orgId),
  ]);
  if (!thread) notFound();
  const pricing = org.settings.pricing;
  const messages: ThreadMessage[] = thread.messages.map((m) => ({ ...m, analysis: m.analysis ?? null }));
  const budget = thread.job.budgetMin || thread.job.budgetMax ? `${thread.job.budgetMin ? formatCurrency(thread.job.budgetMin, thread.job.currency) : "?"} – ${thread.job.budgetMax ? formatCurrency(thread.job.budgetMax, thread.job.currency) : "?"}` : "—";
  const floorHit = thread.pricingState.currentOfferUsd > 0 && thread.pricingState.currentOfferUsd <= pricing.minimumPrice;

  return (
    <>
      <PageHeader
        title={thread.clientName || "Conversation"}
        description={thread.job.title}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/conversations">
                <ArrowLeft /> All conversations
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/jobs/${thread.job.id}`}>
                <ExternalLink /> Open job
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ThreadPanel conversationId={thread.conversationId} opportunityId={thread.opportunityId} clientName={thread.clientName} clientLanguage={thread.clientLanguage} deal={thread.deal} status={thread.status} messages={messages} />

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <StatusBadge status={thread.status} />
                <Badge variant="outline" className="font-normal">{thread.platformKey}</Badge>
              </div>
              <Link href={`/jobs/${thread.job.id}`} className="text-xs text-accent underline-offset-2 hover:underline">
                View job →
              </Link>
              {thread.deal ? (
                <Link href={`/crm/deals/${thread.deal.id}`} className="text-xs text-accent underline-offset-2 hover:underline">
                  View deal ({thread.deal.status.replace(/_/g, " ")}) →
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Job</CardTitle>
              <CardDescription className="line-clamp-2">{thread.job.title}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <KV k="Category" v={thread.job.category ?? "—"} />
              <KV k="Budget" v={budget} />
              <KV k="Country" v={<span className="flex items-center gap-1.5"><Flag country={thread.job.country} /> {thread.job.country ?? "—"}</span>} />
              <KV k="Language" v={LANGUAGE_NAMES[thread.clientLanguage] ?? thread.clientLanguage} />
              {thread.job.deadline ? <KV k="Deadline" v={formatDate(thread.job.deadline)} /> : null}
              {thread.analysis ? <KV k="Market price" v={formatCurrency(thread.analysis.marketPriceUsd, "USD")} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposal</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {thread.proposal ? (
                <>
                  <KV k="Price" v={formatCurrency(thread.proposal.price, thread.proposal.currency)} />
                  <KV k="USD" v={formatCurrency(thread.proposal.priceUsd, "USD")} />
                  <KV k="Delivery" v={thread.proposal.deliveryDays ? `${thread.proposal.deliveryDays} days` : "—"} />
                  <KV k="Language" v={thread.proposal.language} />
                  <KV k="Sent" v={thread.proposal.sentAt ? formatDateTime(thread.proposal.sentAt) : "Not sent"} />
                </>
              ) : (
                <p className="py-1 text-xs text-muted-foreground">No proposal yet.</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="pricing-state">
            <CardHeader>
              <CardTitle>Pricing state</CardTitle>
              <CardDescription>Negotiation memory used by the Pricing Engine</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatCurrency(thread.pricingState.currentOfferUsd, "USD")}</p>
              <p className="text-[11px] text-muted-foreground">current offer</p>
              <Separator className="my-3" />
              <div className="divide-y divide-border">
                <KV k="Discount applied" v={formatPct(thread.pricingState.discountAppliedPct, 1)} />
                <KV k="Max discount" v={formatPct(pricing.maximumDiscountPct, 0)} />
                <KV k="Rounds" v={thread.pricingState.rounds} />
                <KV k="Floor (min price)" v={<span className={floorHit ? "text-danger" : undefined}>{formatCurrency(pricing.minimumPrice, pricing.currency)}</span>} />
                <KV k="Target / Ideal" v={`${formatCurrency(pricing.targetPrice, pricing.currency)} / ${formatCurrency(pricing.idealPrice, pricing.currency)}`} />
              </div>
              {thread.pricingState.scopeAdjustments.length ? (
                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">Scope adjustments</p>
                  <ul className="flex flex-col gap-1 text-xs">
                    {thread.pricingState.scopeAdjustments.map((s, i) => (
                      <li key={i} className="rounded-md bg-muted px-2 py-1">{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quotes</CardTitle>
              <CardDescription>{thread.quotes.length ? `${thread.quotes.length} version${thread.quotes.length === 1 ? "" : "s"}` : "No quotes yet"}</CardDescription>
            </CardHeader>
            {thread.quotes.length ? (
              <CardContent>
                <ul className="flex flex-col divide-y divide-border">
                  {thread.quotes.map((q) => (
                    <li key={q.id} className="flex flex-col gap-1 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">v{q.version} · {formatCurrency(q.total, q.currency)}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        <span>{formatCurrency(q.totalUsd, "USD")}</span>
                        <span>discount {formatPct(q.discountPct, 0)}</span>
                        {q.deliveryDays ? <span>{q.deliveryDays}d</span> : null}
                        {q.paymentTerms ? <span>{q.paymentTerms}</span> : null}
                        {q.revisionRounds !== null ? <span>{q.revisionRounds} revisions</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            ) : null}
          </Card>

          {thread.summary ? (
            <Card>
              <CardHeader>
                <CardTitle>Thread summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs leading-relaxed text-muted-foreground">{thread.summary}</p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
