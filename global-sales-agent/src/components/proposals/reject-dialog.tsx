"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";

/** Reject a proposal with a reason. Closes the proposal and marks the opportunity LOST. */
export function RejectProposalButton({ proposalId, size = "sm", variant = "outline", label = "Reject", testId = "proposal-reject", onDone }: { proposalId: string; size?: "xs" | "sm"; variant?: "outline" | "ghost" | "danger"; label?: string; testId?: string; onDone?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/proposals/${proposalId}/reject`, { method: "POST", json: { reason: reason.trim() || "rejected" } });
      toast.success("Proposal rejected");
      setOpen(false);
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} data-testid={testId} title="Reject proposal">
        <XCircle />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Reject proposal" description="The proposal is closed and the opportunity is marked LOST. The reason is recorded in the audit log.">
          <Field label="Reason">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Budget too low, client history unclear…" autoFocus data-testid="proposal-reject-reason" />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={confirm} loading={busy} data-testid="proposal-reject-confirm">Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
