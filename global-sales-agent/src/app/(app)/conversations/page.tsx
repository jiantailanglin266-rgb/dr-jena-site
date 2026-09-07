import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { listConversations } from "@/lib/services/conversations";
import { PageHeader, EmptyState, Flag } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SyncRepliesButton } from "@/components/conversations/sync-button";
import { cn, timeAgo, truncate } from "@/lib/utils";
import type { LeadStatus } from "@prisma/client";

const LEAD_STATUSES: LeadStatus[] = ["DISCOVERED", "QUALIFIED", "PROPOSAL_CREATED", "PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT", "WON", "LOST"];

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ pending?: string; status?: string; page?: string }> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const pendingOnly = sp.pending === "1";
  const status = LEAD_STATUSES.includes(sp.status as LeadStatus) ? (sp.status as LeadStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, pageSize } = await listConversations(user.orgId, { pendingOnly, status, page, pageSize: 50 });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const filterHref = (patch: { pending?: string; status?: string }) => {
    const q = new URLSearchParams();
    const p = patch.pending ?? (pendingOnly ? "1" : "");
    const s = patch.status ?? status ?? "";
    if (p) q.set("pending", p);
    if (s) q.set("status", s);
    const str = q.toString();
    return `/conversations${str ? `?${str}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Conversations" description="Client replies, AI drafts awaiting approval, and negotiation threads." actions={<SyncRepliesButton />} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Link href={filterHref({ pending: "" })} className={cn("rounded-full border px-3 py-1 transition-colors", !pendingOnly ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
          All
        </Link>
        <Link href={filterHref({ pending: "1" })} className={cn("rounded-full border px-3 py-1 transition-colors", pendingOnly ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")} data-testid="conversations-filter-pending">
          Pending approval
        </Link>
        <span className="mx-1 h-4 w-px bg-border" />
        <Link href={filterHref({ status: "" })} className={cn("rounded-full border px-3 py-1 transition-colors", !status ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
          Any status
        </Link>
        {["REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT", "WON", "LOST"].map((s) => (
          <Link key={s} href={filterHref({ status: s })} className={cn("rounded-full border px-3 py-1 transition-colors", status === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
            {s.replace(/_/g, " ")}
          </Link>
        ))}
        <span className="ml-auto text-muted-foreground">{total} thread{total === 1 ? "" : "s"}</span>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<MessagesSquare />} title={pendingOnly ? "No drafts awaiting approval" : "No conversations yet"} description={pendingOnly ? "AI replies that need a human decision will appear here." : "Conversations start when a client replies to a sent proposal. Try “Sync replies”."} />
      ) : (
        <Card>
          <ul className="divide-y divide-border" data-testid="conversations-list">
            {items.map((c) => {
              const last = c.messages[0];
              const pending = last?.approvalStatus === "PENDING" && !last.sentAt;
              const job = c.opportunity.job;
              const client = job.clientName ?? "Unknown client";
              const preview = last ? (last.direction === "OUTBOUND" ? "You: " : "") + truncate((last.bodyTranslated ?? last.body).replace(/\s+/g, " "), 140) : "No messages yet";
              return (
                <li key={c.id}>
                  <Link href={`/conversations/${c.id}`} className={cn("flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/50", pending && "bg-warning-soft/40")} data-testid="conversation-row" data-pending={pending ? "1" : "0"}>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground">{client.slice(0, 1)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{client}</span>
                        <Flag country={job.clientCountry} />
                        <Badge variant="outline" className="font-normal">{job.platformKey}</Badge>
                        <StatusBadge status={c.opportunity.status} />
                        {pending ? <Badge variant="warning" data-testid="conversation-pending">PENDING</Badge> : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{job.projectTitle}</p>
                      <p className={cn("mt-1.5 line-clamp-1 text-xs", last?.direction === "INBOUND" && !last.sentAt ? "text-foreground" : "text-muted-foreground")}>{preview}</p>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                      <p>{timeAgo(c.lastMessageAt ?? c.updatedAt)}</p>
                      <p className="mt-1 tabular-nums">{c._count.messages} msg</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          {page > 1 ? <Link href={`${filterHref({})}${filterHref({}).includes("?") ? "&" : "?"}page=${page - 1}`} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">Prev</Link> : null}
          <span>Page {page} / {pages}</span>
          {page < pages ? <Link href={`${filterHref({})}${filterHref({}).includes("?") ? "&" : "?"}page=${page + 1}`} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">Next</Link> : null}
        </div>
      ) : null}
    </>
  );
}
