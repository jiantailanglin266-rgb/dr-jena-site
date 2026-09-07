"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function SyncRepliesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    try {
      const r = await api<{ platformKey: string; received: number; error?: string }[]>("/api/conversations/sync", { method: "POST", json: {} });
      const received = r.reduce((s, x) => s + x.received, 0);
      const errors = r.filter((x) => x.error);
      toast.success(`Replies synced: ${received} new`, { description: errors.length ? errors.map((x) => `${x.platformKey}: ${x.error}`).join(" · ") : undefined });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={sync} loading={busy} data-testid="sync-replies">
      <RefreshCw />
      Sync replies
    </Button>
  );
}
