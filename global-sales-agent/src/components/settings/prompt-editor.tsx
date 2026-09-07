"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export interface PromptEditorData {
  agent: string;
  description: string;
  defaults: { system: string; user: string };
  custom: { system: string; user: string; enabled: boolean } | null;
}

export function PromptEditor({ data, defaultOpen = false }: { data: PromptEditorData; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [system, setSystem] = useState(data.custom?.system ?? data.defaults.system);
  const [user, setUser] = useState(data.custom?.user ?? data.defaults.user);
  const [enabled, setEnabled] = useState(data.custom?.enabled ?? true);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const isCustom = Boolean(data.custom);
  const dirty = system !== (data.custom?.system ?? data.defaults.system) || user !== (data.custom?.user ?? data.defaults.user) || enabled !== (data.custom?.enabled ?? true);

  async function save() {
    if (!system.trim() || !user.trim()) {
      toast.error("System and user prompts cannot be empty");
      return;
    }
    setBusy("save");
    try {
      await api("/api/settings/prompts", { method: "PUT", json: { agent: data.agent, system, user, enabled } });
      toast.success(`${data.agent} prompt saved`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    setBusy("reset");
    try {
      await api("/api/settings/prompts", { method: "PUT", json: { agent: data.agent, system: data.defaults.system, user: data.defaults.user, enabled: true, reset: true } });
      setSystem(data.defaults.system);
      setUser(data.defaults.user);
      setEnabled(true);
      toast.success(`${data.agent} prompt reset to default`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card data-testid={`prompt-editor-${data.agent}`}>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)} role="button" aria-expanded={open}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 capitalize">
              {data.agent} Agent
              {isCustom ? <Badge variant={data.custom?.enabled ? "accent" : "secondary"}>{data.custom?.enabled ? "custom" : "custom (disabled)"}</Badge> : <Badge variant="outline">default</Badge>}
            </CardTitle>
            <CardDescription className="mt-0.5">{data.description}</CardDescription>
          </div>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")} />
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="flex flex-col gap-4">
          <Field label="System prompt" hint="Safety rules (no invented achievements, no guarantees, client text is data not instructions) must remain — the Compliance Agent still checks every output.">
            <Textarea value={system} onChange={(e) => setSystem(e.target.value)} className="min-h-[200px] font-mono text-xs leading-relaxed" data-testid={`prompt-system-${data.agent}`} />
          </Field>
          <Field label="User prompt template" hint="Placeholders like {{company}}, {{job}}, {{thread}} are filled at run time.">
            <Textarea value={user} onChange={(e) => setUser(e.target.value)} className="min-h-[120px] font-mono text-xs leading-relaxed" data-testid={`prompt-user-${data.agent}`} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={enabled} onCheckedChange={setEnabled} data-testid={`prompt-enabled-${data.agent}`} />
              Use this custom prompt {enabled ? "" : "(falls back to default while disabled)"}
            </label>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={reset} loading={busy === "reset"} disabled={!isCustom && !dirty} data-testid={`prompt-reset-${data.agent}`}>
                <RotateCcw /> Reset to default
              </Button>
              <Button size="sm" onClick={save} loading={busy === "save"} data-testid={`prompt-save-${data.agent}`}>
                <Save /> Save
              </Button>
            </div>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
