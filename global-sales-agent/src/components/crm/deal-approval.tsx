"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { cn, formatCurrency } from "@/lib/utils";

export interface ChecklistRow {
  key: string;
  label: string;
  confirmed: boolean;
  value: string | null;
}

export function DealApproval({ dealId, status, currency, amount, notes, checklist, unresolved }: { dealId: string; status: string; currency: string; amount: number; notes: string; checklist: ChecklistRow[]; unresolved: string[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ChecklistRow[]>(checklist);
  const [amt, setAmt] = useState(String(amount || ""));
  const [note, setNote] = useState(notes);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = status === "WON" || status === "LOST";
  const confirmedCount = rows.filter((r) => r.confirmed).length;
  const allConfirmed = rows.length > 0 && confirmedCount === rows.length;
  const amountNum = Number(amt);

  function update(key: string, patch: Partial<ChecklistRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function approve() {
    setBusy(true);
    try {
      await api(`/api/deals/${dealId}/approve`, {
        method: "POST",
        json: {
          checklist: rows.map((r) => ({ key: r.key, confirmed: r.confirmed, value: r.value?.trim() ? r.value.trim() : null })),
          ...(Number.isFinite(amountNum) && amountNum > 0 ? { amount: amountNum } : {}),
          ...(note.trim() ? { notes: note.trim() } : {}),
        },
      });
      toast.success("Deal approved — marked WON");
      setConfirm(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <span className={cn("font-semibold tabular-nums", allConfirmed ? "text-success" : "text-warning")}>{confirmedCount}/{rows.length}</span> items confirmed
        </p>
        {locked ? (
          <Badge variant="outline" className="gap-1"><Lock className="size-3" /> Locked</Badge>
        ) : null}
      </div>

      <Table data-testid="deal-checklist">
        <THead>
          <TR>
            <TH className="w-10">OK</TH>
            <TH className="w-56">Item</TH>
            <TH>Value</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const flagged = unresolved.includes(r.key);
            return (
              <TR key={r.key} className={cn(!r.confirmed && "bg-warning-soft/40")} data-testid={`deal-checklist-row-${r.key}`}>
                <TD>
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer rounded border-border accent-[var(--success)] disabled:cursor-not-allowed"
                    checked={r.confirmed}
                    onChange={(e) => update(r.key, { confirmed: e.target.checked })}
                    disabled={locked}
                    aria-label={`Confirm ${r.label}`}
                    data-testid={`deal-check-${r.key}`}
                  />
                </TD>
                <TD>
                  <p className="text-xs font-medium">{r.label}</p>
                  {flagged && !r.confirmed ? <p className="text-[11px] text-warning">Unresolved by AI — verify with client</p> : null}
                </TD>
                <TD>
                  <Input value={r.value ?? ""} onChange={(e) => update(r.key, { value: e.target.value })} placeholder="Not agreed yet" className="h-8 text-xs" disabled={locked} data-testid={`deal-value-${r.key}`} />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <Field label={`Amount (${currency})`} hint={Number.isFinite(amountNum) && amountNum > 0 ? formatCurrency(amountNum, currency) : "Enter the final agreed amount"}>
          <Input type="number" min={0} step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} disabled={locked} data-testid="deal-amount" />
        </Field>
        <Field label="Notes">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="min-h-[72px]" placeholder="Approval notes (internal)" disabled={locked} data-testid="deal-notes" />
        </Field>
      </div>

      {!locked ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">Marking WON updates the pipeline, closes the proposal, syncs the client to CRM and creates a kick-off task. This cannot be undone.</p>
          <Button variant="success" onClick={() => setConfirm(true)} disabled={!allConfirmed || busy} data-testid="deal-approve" title={allConfirmed ? undefined : "Confirm every checklist item first"}>
            <ShieldCheck /> Approve & mark WON
          </Button>
        </div>
      ) : null}

      <Dialog open={confirm} onOpenChange={(o) => !busy && setConfirm(o)}>
        <DialogContent title="Approve deal and mark WON?" description="You are confirming that all nine terms have been agreed with the client.">
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <p className="font-semibold tabular-nums">{Number.isFinite(amountNum) && amountNum > 0 ? formatCurrency(amountNum, currency) : formatCurrency(amount, currency)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{confirmedCount}/{rows.length} checklist items confirmed{note.trim() ? ` · notes attached` : ""}</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={busy}>Cancel</Button>
            </DialogClose>
            <Button variant="success" size="sm" onClick={approve} loading={busy} data-testid="deal-approve-confirm">
              <ShieldCheck /> Confirm — mark WON
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
