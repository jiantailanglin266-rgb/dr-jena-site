"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";

const STATUSES = ["WAITING_APPROVAL", "DRAFT", "AI_REVIEWED", "APPROVED", "SCHEDULED", "SENT", "FAILED", "REPLIED", "CLOSED"];

/** Status filter: navigates to /proposals?status=… (keeps platformKey). */
export function ProposalsStatusFilter({ value, platforms }: { value: string; platforms: { key: string; label: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  function navigate(patch: Record<string, string>) {
    const u = new URLSearchParams();
    const next = { status: sp.get("status") ?? "", platformKey: sp.get("platformKey") ?? "", ...patch };
    for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
    router.push(`/proposals${u.size ? `?${u.toString()}` : ""}`);
  }
  return (
    <div className="flex items-center gap-2">
      <Select className="h-8 w-[170px] text-xs" value={value} onChange={(e) => navigate({ status: e.target.value })} data-testid="proposal-status-filter" aria-label="Status">
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </Select>
      <Select className="h-8 w-[150px] text-xs" value={sp.get("platformKey") ?? ""} onChange={(e) => navigate({ platformKey: e.target.value })} aria-label="Platform">
        <option value="">All platforms</option>
        {platforms.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </Select>
    </div>
  );
}
