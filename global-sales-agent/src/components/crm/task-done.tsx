"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function TaskStatusButton({ id, status }: { id: string; status: "OPEN" | "DONE" | "CANCELLED" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toDone = status !== "DONE";
  async function toggle() {
    setBusy(true);
    try {
      await api(`/api/crm/tasks/${id}`, { method: "PATCH", json: { status: toDone ? "DONE" : "OPEN" } });
      toast.success(toDone ? "Task completed" : "Task reopened");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  return toDone ? (
    <Button size="xs" variant="outline" onClick={toggle} loading={busy} data-testid="task-done">
      <Check /> Done
    </Button>
  ) : (
    <Button size="xs" variant="ghost" onClick={toggle} loading={busy} data-testid="task-reopen">
      <RotateCcw /> Reopen
    </Button>
  );
}
