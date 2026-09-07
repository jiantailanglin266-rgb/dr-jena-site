"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, FileText, Ban, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

type AnalyzeResult = { qualified?: boolean; scores?: { opportunityScore?: number } } & Record<string, unknown>;

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

/** Analyze (or re-analyze) a single job. */
export function AnalyzeButton({ jobId, label = "Analyze", variant = "outline", size = "xs", testId = "job-analyze", icon = "sparkles" }: { jobId: string; label?: string; variant?: "outline" | "default" | "ghost" | "secondary"; size?: "xs" | "sm" | "default"; testId?: string; icon?: "sparkles" | "refresh" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await api<AnalyzeResult>(`/api/jobs/${jobId}/analyze`, { method: "POST", json: {} });
      const score = typeof r?.scores?.opportunityScore === "number" ? ` — score ${r.scores.opportunityScore}` : "";
      toast.success(`Analysis complete${score}`, { description: r?.qualified === undefined ? undefined : r.qualified ? "Qualified" : "Not qualified" });
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} size={size} onClick={run} loading={busy} data-testid={testId} title={label}>
      {icon === "refresh" ? <RefreshCw /> : <Sparkles />}
      {label}
    </Button>
  );
}

/** Exclude a job with a reason (dialog). */
export function ExcludeButton({ jobId, size = "xs", variant = "ghost", label = "Exclude" }: { jobId: string; size?: "xs" | "sm"; variant?: "ghost" | "outline"; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Not a fit");
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/jobs/${jobId}/exclude`, { method: "POST", json: { reason: reason.trim() || "manual" } });
      toast.success("Job excluded");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} data-testid="job-exclude" title="Exclude">
        <Ban />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Exclude job" description="The job is marked EXCLUDED and its opportunity is closed as LOST.">
          <Field label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this job excluded?" autoFocus data-testid="job-exclude-reason" />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={confirm} loading={busy} data-testid="job-exclude-confirm">Exclude</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Create the first proposal draft with default options. */
export function CreateProposalButton({ jobId, size = "xs", variant = "outline", label = "Create proposal" }: { jobId: string; size?: "xs" | "sm"; variant?: "outline" | "default"; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const p = await api<{ id: string; status: string }>(`/api/jobs/${jobId}/proposal`, { method: "POST", json: {} });
      toast.success("Proposal drafted", { description: `Status: ${p.status.replace(/_/g, " ")}` });
      router.push(`/jobs/${jobId}`);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} size={size} onClick={run} loading={busy} data-testid="job-create-proposal" title={label}>
      <FileText />
      {label}
    </Button>
  );
}

/** Row action group for the jobs table. */
export function JobRowActions({ jobId, status, hasProposal }: { jobId: string; status: string; hasProposal: boolean }) {
  const excluded = status === "EXCLUDED" || status === "ARCHIVED";
  return (
    <div className="flex items-center justify-end gap-1">
      {!excluded ? <AnalyzeButton jobId={jobId} variant="ghost" label={status === "NEW" ? "Analyze" : "Re-analyze"} /> : null}
      {!excluded && !hasProposal ? <CreateProposalButton jobId={jobId} variant="outline" /> : null}
      {!excluded ? <ExcludeButton jobId={jobId} /> : null}
      <Button asChild variant="ghost" size="xs">
        <Link href={`/jobs/${jobId}`} title="View" data-testid="job-view">
          <Eye />
          View
        </Link>
      </Button>
    </div>
  );
}
