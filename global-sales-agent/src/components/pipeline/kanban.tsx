"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, ExternalLink, MessagesSquare, ArrowRight, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown";
import { api } from "@/lib/client-api";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";

export const LEAD_STATUSES = ["DISCOVERED", "QUALIFIED", "PROPOSAL_CREATED", "PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT", "WON", "LOST"] as const;
export type LeadStatusKey = (typeof LEAD_STATUSES)[number];

export interface KanbanItem {
  id: string;
  jobId: string;
  title: string;
  status: string;
  clientName: string | null;
  clientCountry: string | null;
  platformKey: string;
  category: string | null;
  score: number | null;
  valueUsd: number | null;
  stageChangedAt: string;
  conversationId: string | null;
  dealId: string | null;
}

const COLUMN_ACCENT: Partial<Record<LeadStatusKey, string>> = { WON: "bg-success", LOST: "bg-danger", VERBAL_ACCEPT: "bg-success/70", NEGOTIATING: "bg-warning", FINAL_NEGOTIATION: "bg-warning", QUOTE_SENT: "bg-accent", MEETING_REQUESTED: "bg-accent", REPLIED: "bg-accent/70", PROPOSAL_SENT: "bg-info", PROPOSAL_CREATED: "bg-info/70" };

export function KanbanBoard({ items }: { items: KanbanItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function move(item: KanbanItem, status: LeadStatusKey) {
    setBusy(item.id);
    try {
      await api(`/api/opportunities/${item.id}`, { method: "PATCH", json: { status } });
      toast.success(`Moved to ${status.replace(/_/g, " ")}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to move");
    } finally {
      setBusy(null);
    }
  }

  async function markLost(item: KanbanItem) {
    const reason = window.prompt("Reason for marking this opportunity as LOST:", "budget");
    if (reason === null) return;
    setBusy(item.id);
    try {
      await api(`/api/opportunities/${item.id}/lost`, { method: "POST", json: { reason: reason.trim() || "lost" } });
      toast.success("Marked as LOST");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8" data-testid="kanban">
      <div className="flex min-w-max items-start gap-3">
        {LEAD_STATUSES.map((status) => {
          const col = items.filter((i) => i.status === status);
          const total = col.reduce((s, i) => s + (i.valueUsd ?? 0), 0);
          return (
            <section key={status} className="flex w-[268px] shrink-0 flex-col rounded-xl border border-border bg-muted/40" data-testid={`kanban-column-${status}`}>
              <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", COLUMN_ACCENT[status] ?? "bg-muted-foreground/40")} />
                  <h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{status.replace(/_/g, " ")}</h3>
                </div>
                <Badge variant="outline" className="tabular-nums">{col.length}</Badge>
              </header>
              <p className="px-3 pb-2 text-[11px] tabular-nums text-muted-foreground">{formatCurrency(total, "USD")}</p>
              <div className="flex flex-col gap-2 px-2 pb-2">
                {col.length === 0 ? <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">Empty</div> : null}
                {col.map((item) => (
                  <KanbanCard key={item.id} item={item} busy={busy === item.id} onMove={(s) => move(item, s)} onLost={() => markLost(item)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ item, busy, onMove, onLost }: { item: KanbanItem; busy: boolean; onMove: (s: LeadStatusKey) => void; onLost: () => void }) {
  const score = item.score ?? null;
  const scoreColor = score === null ? "text-muted-foreground" : score >= 80 ? "text-success" : score >= 60 ? "text-accent" : score >= 40 ? "text-warning" : "text-danger";
  const targets = LEAD_STATUSES.filter((s) => s !== "WON" && s !== "LOST" && s !== item.status);
  const locked = item.status === "WON";
  return (
    <article className={cn("group rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md", busy && "opacity-60")} data-testid="kanban-card" data-status={item.status}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/jobs/${item.jobId}`} className="line-clamp-2 text-[13px] font-medium leading-snug hover:underline">
          {item.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-7 w-7 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" aria-label="Card actions" disabled={busy}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link href={`/jobs/${item.jobId}`}>
                <ExternalLink className="size-3.5" /> Open job
              </Link>
            </DropdownMenuItem>
            {item.conversationId ? (
              <DropdownMenuItem asChild>
                <Link href={`/conversations/${item.conversationId}`}>
                  <MessagesSquare className="size-3.5" /> Open conversation
                </Link>
              </DropdownMenuItem>
            ) : null}
            {item.dealId ? (
              <DropdownMenuItem asChild>
                <Link href={`/crm/deals/${item.dealId}`}>
                  <ArrowRight className="size-3.5" /> Open deal
                </Link>
              </DropdownMenuItem>
            ) : null}
            {!locked ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Move to …</DropdownMenuLabel>
                <div className="max-h-56 overflow-y-auto">
                  {targets.map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                      <span className="text-muted-foreground">→</span> {s.replace(/_/g, " ")}
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                {item.status !== "LOST" ? (
                  <DropdownMenuItem className="text-danger" onSelect={onLost}>
                    <XCircle className="size-3.5" /> Mark lost
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>WON — locked (approved deal)</DropdownMenuLabel>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Flag country={item.clientCountry} />
        <span className="truncate">{item.clientName ?? "Unknown client"}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="font-normal">{item.platformKey}</Badge>
          {score !== null ? <span className={cn("text-[11px] font-semibold tabular-nums", scoreColor)} title="Opportunity score">{score}</span> : null}
        </div>
        <span className="text-xs font-medium tabular-nums">{item.valueUsd ? formatCurrency(item.valueUsd, "USD") : "—"}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{timeAgo(item.stageChangedAt)}</p>
    </article>
  );
}
