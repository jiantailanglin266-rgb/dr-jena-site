"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function DashboardActions({ labels }: { labels: { discover: string; sync: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(kind: "discover" | "sync") {
    setBusy(kind);
    try {
      if (kind === "discover") {
        const r = await api<{ created: number; summary: { platformKey: string; fetched: number; created: number; error?: string }[] }>("/api/jobs/discover", { method: "POST", json: { limit: 100 } });
        toast.success(`Discovery: ${r.created} new job(s)`, { description: r.summary.map((s) => `${s.platformKey}: ${s.fetched} fetched${s.error ? ` — ${s.error}` : ""}`).join(" · ") });
      } else {
        const r = await api<{ platformKey: string; received: number; error?: string }[]>("/api/conversations/sync", { method: "POST", json: {} });
        toast.success(`Replies synced: ${r.reduce((s, x) => s + x.received, 0)} new`);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => run("sync")} loading={busy === "sync"} data-testid="sync-replies">
        <RefreshCw />
        {labels.sync}
      </Button>
      <Button size="sm" onClick={() => run("discover")} loading={busy === "discover"} data-testid="run-discovery">
        <Radar />
        {labels.discover}
      </Button>
    </>
  );
}
