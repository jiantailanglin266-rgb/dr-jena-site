"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Scale, FileCheck2, Send, Check, X, Bot, User, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/client-api";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export interface ThreadMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  authorType: "AI" | "HUMAN" | "CLIENT" | "SYSTEM";
  language: string | null;
  body: string;
  bodyTranslated: string | null;
  category: string | null;
  analysis: unknown;
  createdAt: string;
  sentAt: string | null;
  approvalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
}

interface ReplyAnalysis {
  sentiment?: string;
  purchase_probability?: number;
  urgency?: number;
  next_best_action?: string;
  intent?: string;
  summary?: string;
}

function readAnalysis(a: unknown): ReplyAnalysis | null {
  if (!a || typeof a !== "object") return null;
  return a as ReplyAnalysis;
}

export function ThreadPanel({ conversationId, opportunityId, clientName, clientLanguage, deal, status, messages }: { conversationId: string; opportunityId: string; clientName: string; clientLanguage: string; deal: { id: string; status: string } | null; status: string; messages: ThreadMessage[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [compose, setCompose] = useState("");
  const pendingCount = messages.filter((m) => m.direction === "OUTBOUND" && m.approvalStatus === "PENDING" && !m.sentAt).length;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const draftReply = () =>
    run("draft", async () => {
      const m = await api<{ approvalStatus: string }>(`/api/conversations/${conversationId}/draft`, { method: "POST", json: {} });
      toast.success(m.approvalStatus === "PENDING" ? "AI reply drafted — review and approve" : "AI reply generated");
    });
  const negotiate = () =>
    run("negotiate", async () => {
      const r = await api<{ message: { approvalStatus: string }; negotiation: { strategy?: string; offer_price?: number; currency?: string } }>(`/api/conversations/${conversationId}/negotiate`, { method: "POST", json: {} });
      const n = r.negotiation;
      toast.success("Negotiation draft ready", { description: n?.offer_price ? `${n.strategy ?? "offer"} · ${n.offer_price} ${n.currency ?? ""}` : undefined });
    });
  const dealSummary = () =>
    run("deal", async () => {
      const r = await api<{ deal: { id: string } }>(`/api/opportunities/${opportunityId}/deal-summary`, { method: "POST", json: {} });
      toast.success("Deal summary created — review checklist to approve");
      router.push(`/crm/deals/${r.deal.id}`);
    });
  const send = () =>
    run("send", async () => {
      const body = compose.trim();
      if (!body) throw new Error("Message is empty");
      await api(`/api/conversations/${conversationId}/messages`, { method: "POST", json: { body, send: true } });
      setCompose("");
      toast.success("Message sent");
    });

  const closed = status === "WON" || status === "LOST";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Thread</CardTitle>
            <CardDescription>
              {messages.length} message{messages.length === 1 ? "" : "s"} · client language <span className="uppercase">{clientLanguage}</span>
              {pendingCount ? <> · <span className="font-medium text-warning">{pendingCount} draft{pendingCount === 1 ? "" : "s"} awaiting approval</span></> : null}
            </CardDescription>
          </div>
          <StatusBadge status={status} />
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-4" data-testid="thread">
            {messages.length === 0 ? <li className="py-8 text-center text-xs text-muted-foreground">No messages yet — generate an AI reply or write one below.</li> : null}
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} clientName={clientName} busy={busy} onBusy={(k, fn) => run(k, fn)} />
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>Write directly to the client (sent as a human message in {clientLanguage.toUpperCase()}).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea value={compose} onChange={(e) => setCompose(e.target.value)} placeholder="Type your message…" rows={4} className="min-h-[96px]" data-testid="compose-body" disabled={closed} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={draftReply} loading={busy === "draft"} disabled={!!busy || closed} data-testid="draft-reply">
              <Sparkles /> Generate AI reply
            </Button>
            <Button variant="outline" size="sm" onClick={negotiate} loading={busy === "negotiate"} disabled={!!busy || closed} data-testid="draft-negotiate">
              <Scale /> Negotiate (Pricing Engine)
            </Button>
            {deal ? (
              <Button variant="secondary" size="sm" asChild data-testid="create-deal-summary">
                <Link href={`/crm/deals/${deal.id}`}>
                  <Handshake /> Open deal ({deal.status.replace(/_/g, " ")})
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={dealSummary} loading={busy === "deal"} disabled={!!busy || closed} data-testid="create-deal-summary">
                <FileCheck2 /> Create Deal Summary
              </Button>
            )}
            <div className="ml-auto">
              <Button size="sm" onClick={send} loading={busy === "send"} disabled={!!busy || !compose.trim() || closed} data-testid="compose-send">
                <Send /> Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageBubble({ m, clientName, busy, onBusy }: { m: ThreadMessage; clientName: string; busy: string | null; onBusy: (key: string, fn: () => Promise<void>) => Promise<void> }) {
  const inbound = m.direction === "INBOUND";
  const isDraft = !inbound && m.approvalStatus === "PENDING" && !m.sentAt;
  const rejected = !inbound && m.approvalStatus === "REJECTED";
  const [body, setBody] = useState(m.body);
  const analysis = inbound ? readAnalysis(m.analysis) : null;

  const approve = () =>
    onBusy(`approve-${m.id}`, async () => {
      await api(`/api/messages/${m.id}/approve`, { method: "POST", json: { body: body.trim() } });
      toast.success("Approved & sent");
    });
  const reject = () =>
    onBusy(`reject-${m.id}`, async () => {
      const reason = window.prompt("Reason for rejecting this draft (optional):", "") ?? undefined;
      await api(`/api/messages/${m.id}/reject`, { method: "POST", json: reason ? { reason } : {} });
      toast.success("Draft rejected");
    });

  return (
    <li className={cn("flex", inbound ? "justify-start" : "justify-end")} data-testid={inbound ? "message-inbound" : "message-outbound"} data-message-id={m.id}>
      <div className={cn("w-full max-w-[85%] lg:max-w-[75%]", inbound ? "" : "text-left")}>
        <div className={cn("mb-1 flex items-center gap-2 text-[11px] text-muted-foreground", inbound ? "" : "justify-end")}>
          {inbound ? (
            <>
              <span className="flex size-5 items-center justify-center rounded-full bg-muted"><User className="size-3" /></span>
              <span className="font-medium text-foreground">{clientName || "Client"}</span>
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{m.authorType === "AI" ? "AI draft" : m.authorType === "HUMAN" ? "You" : m.authorType}</span>
              <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent">{m.authorType === "AI" ? <Bot className="size-3" /> : <User className="size-3" />}</span>
            </>
          )}
          {m.language ? <span className="uppercase">{m.language}</span> : null}
          <span title={formatDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</span>
        </div>

        <div className={cn("rounded-2xl border px-4 py-3 text-sm leading-relaxed", inbound ? "rounded-tl-sm border-border bg-muted/60" : isDraft ? "rounded-tr-sm border-warning/40 bg-warning-soft" : rejected ? "rounded-tr-sm border-border bg-card opacity-60" : "rounded-tr-sm border-accent/20 bg-accent-soft/60")}>
          {isDraft ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="warning">PENDING APPROVAL</Badge>
                <span className="text-[11px] text-muted-foreground">Edit before sending if needed</span>
              </div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="bg-card" data-testid="message-edit-body" />
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={reject} loading={busy === `reject-${m.id}`} disabled={!!busy} data-testid="message-reject">
                  <X /> Reject
                </Button>
                <Button variant="success" size="sm" onClick={approve} loading={busy === `approve-${m.id}`} disabled={!!busy || !body.trim()} data-testid="message-approve">
                  <Check /> Approve & send
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
          )}
          {m.bodyTranslated ? (
            <details className="mt-2 border-t border-border/60 pt-2 text-xs">
              <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Translation</summary>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-muted-foreground">{m.bodyTranslated}</p>
            </details>
          ) : null}
        </div>

        {inbound && (m.category || analysis) ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground" data-testid="message-analysis">
            {m.category ? <span data-testid="message-category"><StatusBadge status={m.category} className="text-[10px]" /></span> : null}
            {analysis?.sentiment ? <StatusBadge status={analysis.sentiment} className="text-[10px]" /> : null}
            {typeof analysis?.purchase_probability === "number" ? <span>buy {analysis.purchase_probability}%</span> : null}
            {typeof analysis?.urgency === "number" ? <span>· urgency {analysis.urgency}</span> : null}
            {analysis?.next_best_action ? <span className="basis-full text-foreground/80">Next: {analysis.next_best_action}</span> : null}
          </div>
        ) : null}
        {!inbound ? (
          <div className="mt-1 flex justify-end gap-2 text-[11px] text-muted-foreground">
            {m.sentAt ? <span>Sent {formatDateTime(m.sentAt)}</span> : rejected ? <Badge variant="danger">REJECTED</Badge> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
