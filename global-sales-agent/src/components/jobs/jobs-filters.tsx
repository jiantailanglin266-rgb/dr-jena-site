"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export type JobsQuery = { status?: string; platformKey?: string; category?: string; country?: string; q?: string; minScore?: string; sort?: string; page?: string };

const STATUSES = ["NEW", "ANALYZED", "QUALIFIED", "EXCLUDED", "ARCHIVED"];

export function JobsFilters({ initial, platforms }: { initial: JobsQuery; platforms: { key: string; label: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<JobsQuery>(initial);
  const set = (k: keyof JobsQuery) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function apply(next: JobsQuery = f) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && k !== "page") sp.set(k, String(v));
    startTransition(() => router.push(`/jobs${sp.size ? `?${sp.toString()}` : ""}`));
  }
  function reset() {
    setF({});
    apply({});
  }
  const dirty = Object.values(f).some(Boolean);

  return (
    <form
      className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      data-testid="jobs-filters"
    >
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-8 pl-8 text-xs" placeholder="Search title, description, client…" value={f.q ?? ""} onChange={set("q")} name="q" />
      </div>
      <Select className="h-8 w-[130px] text-xs" value={f.status ?? ""} onChange={(e) => { set("status")(e); apply({ ...f, status: e.target.value }); }} name="status" aria-label="Status">
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Select className="h-8 w-[150px] text-xs" value={f.platformKey ?? ""} onChange={(e) => { set("platformKey")(e); apply({ ...f, platformKey: e.target.value }); }} name="platformKey" aria-label="Platform">
        <option value="">All platforms</option>
        {platforms.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </Select>
      <Input className="h-8 w-[130px] text-xs" placeholder="Category" value={f.category ?? ""} onChange={set("category")} name="category" />
      <Input className="h-8 w-[90px] text-xs uppercase" placeholder="Country" maxLength={2} value={f.country ?? ""} onChange={set("country")} name="country" />
      <Input className="h-8 w-[100px] text-xs tabular-nums" type="number" min={0} max={100} placeholder="Min score" value={f.minScore ?? ""} onChange={set("minScore")} name="minScore" />
      <Select className="h-8 w-[120px] text-xs" value={f.sort ?? "score"} onChange={(e) => { set("sort")(e); apply({ ...f, sort: e.target.value }); }} name="sort" aria-label="Sort">
        <option value="score">Sort: score</option>
        <option value="posted">Sort: posted</option>
        <option value="budget">Sort: budget</option>
      </Select>
      <Button type="submit" size="sm" variant="secondary" loading={pending}>Apply</Button>
      {dirty ? (
        <Button type="button" size="sm" variant="ghost" onClick={reset}>
          <X />
          Clear
        </Button>
      ) : null}
    </form>
  );
}
