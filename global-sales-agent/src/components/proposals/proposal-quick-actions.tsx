"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { RejectProposalButton } from "./reject-dialog";

/** Inline Approve / Reject for WAITING_APPROVAL rows in the proposals table. */
export function ProposalQuickActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function approve() {
    setBusy(true);
    try {
      const r = await api<{ status: string }>(`/api/proposals/${proposalId}/approve`, { method: "POST", json: {} });
      toast.success(r.status === "SENT" ? "Approved and sent" : "Approved", { description: r.status !== "SENT" ? `Status: ${r.status.replace(/_/g, " ")}` : undefined });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <RejectProposalButton proposalId={proposalId} size="xs" variant="ghost" />
      <Button variant="success" size="xs" onClick={approve} loading={busy} data-testid="proposal-approve">
        <Check />
        Approve
      </Button>
    </div>
  );
}
