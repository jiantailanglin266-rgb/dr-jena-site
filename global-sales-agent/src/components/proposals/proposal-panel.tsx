"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, MessagesSquare, Pencil, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KV, Separator } from "@/components/ui/misc";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { cn, formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";
import { RejectProposalButton } from "./reject-dialog";
import { SECTION_ORDER, type ProposalView } from "./proposal-view";

const LENGTHS = ["SHORT", "STANDARD", "DETAILED"] as const;
const TONES = ["PROFESSIONAL", "FRIENDLY", "CONSULTATIVE", "EXECUTIVE", "TECHNICAL", "PREMIUM"] as const;
const LANGUAGES: { code: string; name: string }[] = [
  { code: "ja", name: "日本語" }, { code: "en", name: "English" }, { code: "zh", name: "中文" }, { code: "ko", name: "한국어" }, { code: "es", name: "Español" },
  { code: "fr", name: "Français" }, { code: "de", name: "Deutsch" }, { code: "pt", name: "Português" }, { code: "it", name: "Italiano" },
];
const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

type Options = { length: string; tone: string; language: string };

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

/** Length / tone / language selectors shared by Generate and Regenerate. */
function OptionsFields({ value, onChange, languageTestId }: { value: Options; onChange: (v: Options) => void; languageTestId?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Length">
        <Select value={value.length} onChange={(e) => onChange({ ...value, length: e.target.value })} data-testid="proposal-length">
          {LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </Field>
      <Field label="Tone">
        <Select value={value.tone} onChange={(e) => onChange({ ...value, tone: e.target.value })} data-testid="proposal-tone">
          {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <Field label="Language (client)">
        <Select value={value.language} onChange={(e) => onChange({ ...value, language: e.target.value })} data-testid={languageTestId}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
        </Select>
      </Field>
    </div>
  );
}

function ProseBlock({ text, className, ...rest }: { text: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("whitespace-pre-wrap rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed", className)} {...rest}>
      {text || <span className="text-muted-foreground">(empty)</span>}
    </div>
  );
}

export function ProposalPanel({ jobId, proposal, defaultLanguage, conversationId, jobStatus, defaultLength = "STANDARD", defaultTone = "CONSULTATIVE" }: {
  jobId: string;
  proposal: ProposalView | null;
  defaultLanguage: string;
  conversationId?: string | null;
  jobStatus: string;
  defaultLength?: string;
  defaultTone?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const initialLang = LANGUAGES.some((l) => l.code === defaultLanguage) ? defaultLanguage : "en";
  const [opts, setOpts] = useState<Options>({ length: proposal?.length ?? defaultLength, tone: proposal?.tone ?? defaultTone, language: proposal?.detectedLanguage ?? initialLang });
  const [regenOpen, setRegenOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [translated, setTranslated] = useState(proposal?.proposalTranslated ?? "");
  const [original, setOriginal] = useState(proposal?.proposalOriginal ?? "");
  const [changeReason, setChangeReason] = useState("");
  const [externalId, setExternalId] = useState("");

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const generate = (regenerate: boolean) =>
    run("generate", async () => {
      const p = await api<{ id: string; status: string }>(`/api/jobs/${jobId}/proposal`, { method: "POST", json: { ...opts, regenerate, changeReason: regenerate ? `regenerated (${opts.length}/${opts.tone}/${opts.language})` : undefined } });
      toast.success(regenerate ? "Proposal regenerated" : "Proposal drafted", { description: `Status: ${p.status.replace(/_/g, " ")}` });
      setRegenOpen(false);
      setEditing(false);
    });

  // ── No proposal yet: generate form ──────────────────────────────────────
  if (!proposal) {
    const blocked = jobStatus === "EXCLUDED" || jobStatus === "ARCHIVED";
    return (
      <Card data-testid="proposal-panel">
        <CardHeader>
          <CardTitle>Proposal</CardTitle>
          <CardDescription>{blocked ? `Job is ${jobStatus}; proposals cannot be generated.` : "Generate a bilingual proposal draft (original + client language) with the 10-section structure."}</CardDescription>
        </CardHeader>
        <CardContent>
          <OptionsFields value={opts} onChange={setOpts} languageTestId="proposal-language" />
          <div className="mt-4 flex items-center justify-end">
            <Button onClick={() => generate(false)} loading={busy === "generate"} disabled={blocked} data-testid="proposal-generate">
              <Sparkles />
              Generate proposal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Existing proposal ───────────────────────────────────────────────────
  const p = proposal;
  const isFinal = ["SENT", "REPLIED", "CLOSED"].includes(p.status);
  const canApprove = ["WAITING_APPROVAL", "AI_REVIEWED", "DRAFT", "FAILED"].includes(p.status);
  const canReject = !["SENT", "REPLIED", "CLOSED"].includes(p.status);
  const canEdit = !isFinal;
  const manualOnly = p.sendMode === "MANUAL_ONLY" || (p.status === "APPROVED" && !!p.failedReason?.includes("MANUAL_ONLY"));
  const canMarkSent = manualOnly && !isFinal;
  const canRetry = p.status === "FAILED" || p.status === "SCHEDULED";
  const blockers = p.compliance.issues.filter((i) => i.severity === "BLOCK");

  const approve = () =>
    run("approve", async () => {
      const r = await api<{ status: string }>(`/api/proposals/${p.id}/approve`, { method: "POST", json: {} });
      toast.success(`Proposal ${r.status === "SENT" ? "approved and sent" : "approved"}`, { description: r.status !== "SENT" ? `Status: ${r.status.replace(/_/g, " ")}` : undefined });
    });
  const retry = () =>
    run("send", async () => {
      const r = await api<{ status: string; error?: string }>(`/api/proposals/${p.id}/send`, { method: "POST", json: {} });
      if (r.status === "SENT") toast.success("Proposal sent");
      else toast.warning(`Send result: ${r.status.replace(/_/g, " ")}`, { description: r.error });
    });
  const markSent = () =>
    run("mark-sent", async () => {
      await api(`/api/proposals/${p.id}/mark-sent`, { method: "POST", json: externalId.trim() ? { externalProposalId: externalId.trim() } : {} });
      toast.success("Marked as sent");
    });
  const save = () =>
    run("save", async () => {
      if (translated.trim().length < 20) throw new Error("Proposal text must be at least 20 characters");
      await api(`/api/proposals/${p.id}`, { method: "PATCH", json: { proposalTranslated: translated, proposalOriginal: original, changeReason: changeReason.trim() || undefined } });
      toast.success("Proposal saved as a new version");
      setEditing(false);
      setChangeReason("");
    });
  async function copyText() {
    try {
      await navigator.clipboard.writeText(p.proposalTranslated);
      toast.success("Proposal text copied", { description: "Paste it into the marketplace, then mark as sent." });
    } catch {
      toast.error("Clipboard unavailable — select the text manually");
    }
  }
  function startEdit() {
    setTranslated(p.proposalTranslated);
    setOriginal(p.proposalOriginal);
    setEditing(true);
  }

  return (
    <Card data-testid="proposal-panel" data-status={p.status}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Proposal</CardTitle>
              <StatusBadge status={p.status} />
              <StatusBadge status={p.sendMode} />
              <Badge variant="outline">Variant {p.variantLabel}</Badge>
              <Badge variant="outline">{p.length}</Badge>
              <Badge variant="outline">{p.tone}</Badge>
            </div>
            <CardDescription className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
              <span className="font-medium text-foreground">{p.proposedPrice !== null ? formatCurrency(p.proposedPrice, p.currency) : "—"}</span>
              {p.proposedPriceUsd !== null && p.currency !== "USD" ? <span>≈ {formatCurrency(p.proposedPriceUsd, "USD")}</span> : null}
              {p.proposedDeliveryDays ? <span>· {p.proposedDeliveryDays} days</span> : null}
              <span data-testid="proposal-language">· {langName(p.sourceLanguage)} → {langName(p.detectedLanguage)} ({p.detectedLanguage})</span>
              {p.sentAt ? <span>· sent {formatDateTime(p.sentAt)}</span> : p.approvedAt ? <span>· approved {formatDateTime(p.approvedAt)}</span> : <span>· updated {timeAgo(p.updatedAt)}</span>}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {conversationId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/conversations/${conversationId}`}>
                  <MessagesSquare />
                  Conversation
                </Link>
              </Button>
            ) : null}
            {canEdit && !editing ? (
              <Button variant="outline" size="sm" onClick={startEdit} data-testid="proposal-edit">
                <Pencil />
                Edit
              </Button>
            ) : null}
            {!isFinal ? (
              <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)} data-testid="proposal-regenerate">
                <RefreshCw />
                Regenerate
              </Button>
            ) : null}
            {canRetry ? (
              <Button variant="outline" size="sm" onClick={retry} loading={busy === "send"} data-testid="proposal-retry-send">
                <Send />
                Retry send
              </Button>
            ) : null}
            {canReject ? <RejectProposalButton proposalId={p.id} /> : null}
            {canApprove ? (
              <Button variant="success" size="sm" onClick={approve} loading={busy === "approve"} data-testid="proposal-approve">
                <Check />
                Approve{p.sendMode === "AUTO" ? " & send" : ""}
              </Button>
            ) : null}
          </div>
        </div>

        {p.failedReason && !manualOnly ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{p.failedReason}</div>
        ) : null}
        {blockers.length && !isFinal ? (
          <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
            Compliance blocked automatic sending: {blockers.map((b) => b.message).join(" · ")}
          </div>
        ) : null}

        {canMarkSent ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs" data-testid="proposal-manual-send">
            <span className="mr-auto text-muted-foreground">Manual send: copy the text, post it on the marketplace, then mark as sent.</span>
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="External proposal ID (optional)" className="h-8 w-56 text-xs" />
            <Button variant="outline" size="sm" onClick={copyText} data-testid="proposal-copy">
              <Copy />
              Copy text
            </Button>
            <Button size="sm" onClick={markSent} loading={busy === "mark-sent"} data-testid="proposal-mark-sent">
              <Check />
              Mark as sent
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-4" data-testid="proposal-edit-form">
            <Field label={`Translated (${langName(p.detectedLanguage)}) — sent to the client`}>
              <Textarea value={translated} onChange={(e) => setTranslated(e.target.value)} className="min-h-[280px] text-sm leading-relaxed" data-testid="proposal-edit-translated" />
            </Field>
            <Field label={`Original (${langName(p.sourceLanguage)})`}>
              <Textarea value={original} onChange={(e) => setOriginal(e.target.value)} className="min-h-[160px] text-sm leading-relaxed" />
            </Field>
            <Field label="Change reason (optional)">
              <Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g. Tightened pricing section" />
            </Field>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X />
                Cancel
              </Button>
              <Button size="sm" onClick={save} loading={busy === "save"} data-testid="proposal-save">
                <Check />
                Save version
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="translated">
            <TabsList>
              <TabsTrigger value="translated">Translated · {p.detectedLanguage}</TabsTrigger>
              <TabsTrigger value="original">Original · {p.sourceLanguage}</TabsTrigger>
              <TabsTrigger value="structured">Structured</TabsTrigger>
              <TabsTrigger value="compliance">
                Compliance{p.compliance.issues.length ? ` (${p.compliance.issues.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="versions">Versions ({p.versions.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="translated">
              {p.subject ? <p className="mb-2 text-sm font-medium">{p.subject}</p> : null}
              <ProseBlock text={p.proposalTranslated} data-testid="proposal-text" />
            </TabsContent>
            <TabsContent value="original">
              <ProseBlock text={p.proposalOriginal} data-testid="proposal-original" />
            </TabsContent>
            <TabsContent value="structured">
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {p.openingStyle ? <Badge variant="outline">opening: {p.openingStyle}</Badge> : null}
                {p.ctaType ? <Badge variant="outline">cta: {p.ctaType}</Badge> : null}
              </div>
              <ol className="flex flex-col divide-y divide-border">
                {SECTION_ORDER.map((s, i) => (
                  <li key={s.key} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
                    <span className="text-xs font-medium text-muted-foreground">
                      <span className="mr-2 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      {s.label}
                    </span>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.sections[s.key] || <span className="text-muted-foreground">—</span>}</p>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent value="compliance">
              <div className="mb-3">
                <KV k="Automated sending" v={p.compliance.allowed === undefined ? "Not checked" : p.compliance.allowed ? <span className="text-success">Allowed</span> : <span className="text-danger">Blocked</span>} />
                <Separator />
              </div>
              {p.compliance.issues.length === 0 ? (
                <p className="text-xs text-muted-foreground">No compliance issues detected.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {p.compliance.issues.map((i, idx) => (
                    <li key={`${i.code ?? "issue"}-${idx}`} className="flex items-start gap-2 text-sm">
                      <Badge variant={i.severity === "BLOCK" ? "danger" : "warning"}>{i.severity}</Badge>
                      <span>
                        {i.message}
                        {i.code ? <span className="ml-2 text-[11px] text-muted-foreground">{i.code}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="versions">
              {p.versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No versions recorded.</p>
              ) : (
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH className="w-14">Ver.</TH>
                      <TH>Author</TH>
                      <TH>Length / tone</TH>
                      <TH>Reason</TH>
                      <TH>Created</TH>
                      <TH className="text-right">Chars</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {p.versions.map((v) => (
                      <TR key={v.id}>
                        <TD className="tabular-nums">v{v.version}</TD>
                        <TD><Badge variant={v.authorType === "AI" ? "accent" : "info"}>{v.authorType}</Badge></TD>
                        <TD className="text-xs text-muted-foreground">{v.length} / {v.tone}</TD>
                        <TD className="text-xs">{v.changeReason ?? "—"}</TD>
                        <TD className="text-xs text-muted-foreground">{formatDateTime(v.createdAt)}</TD>
                        <TD className="text-right tabular-nums text-xs">{v.proposalTranslated.length.toLocaleString()}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent title="Regenerate proposal" description="A new AI version is created; the current text is kept in the version history." className="max-w-xl">
          <OptionsFields value={opts} onChange={setOpts} languageTestId="proposal-regenerate-language" />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => generate(true)} loading={busy === "generate"} data-testid="proposal-regenerate-confirm">
              <RefreshCw />
              Regenerate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
