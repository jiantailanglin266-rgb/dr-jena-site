"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radar, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/client-api";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

const CSV_EXAMPLE = `project_title,project_description,client_name,client_country,client_language,category,budget_min,budget_max,currency,required_skills
"Shopify store redesign","We need a modern responsive redesign of our store…","Acme Inc","US","en","web-development",2000,4000,USD,"Shopify;Liquid;UX"`;

const JSON_EXAMPLE = `[
  {
    "project_title": "Shopify store redesign",
    "project_description": "We need a modern responsive redesign of our store…",
    "client_name": "Acme Inc",
    "client_country": "US",
    "client_language": "en",
    "category": "web-development",
    "budget_min": 2000,
    "budget_max": 4000,
    "currency": "USD",
    "required_skills": ["Shopify", "Liquid", "UX"]
  }
]`;

/** "Analyze all NEW" — sequential analysis of the NEW jobs in the current filtered set with a progress toast. */
export function AnalyzeAllButton({ jobIds }: { jobIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!jobIds.length) return;
    setBusy(true);
    const toastId = toast.loading(`Analyzing 0 / ${jobIds.length}…`);
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < jobIds.length; i++) {
      try {
        await api(`/api/jobs/${jobIds[i]}/analyze`, { method: "POST", json: {} });
        ok += 1;
      } catch {
        failed += 1;
      }
      toast.loading(`Analyzing ${i + 1} / ${jobIds.length}…`, { id: toastId, description: failed ? `${failed} failed` : undefined });
      if ((i + 1) % 5 === 0) router.refresh();
    }
    if (failed) toast.warning(`Analyzed ${ok} job(s), ${failed} failed`, { id: toastId });
    else toast.success(`Analyzed ${ok} job(s)`, { id: toastId });
    setBusy(false);
    router.refresh();
  }
  return (
    <Button variant="outline" size="sm" onClick={run} loading={busy} disabled={!jobIds.length} data-testid="analyze-all" title={jobIds.length ? `Analyze ${jobIds.length} NEW job(s) on this page` : "No NEW jobs on this page"}>
      <Sparkles />
      Analyze all NEW{jobIds.length ? ` (${jobIds.length})` : ""}
    </Button>
  );
}

export function RunDiscoveryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await api<{ created: number; summary: { platformKey: string; fetched: number; created: number; error?: string }[] }>("/api/jobs/discover", { method: "POST", json: { limit: 100 } });
      toast.success(`Discovery: ${r.created} new job(s)`, { description: r.summary.map((s) => `${s.platformKey}: ${s.fetched} fetched${s.error ? ` — ${s.error}` : ""}`).join(" · ") });
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" onClick={run} loading={busy} data-testid="run-discovery">
      <Radar />
      Run discovery
    </Button>
  );
}

export function ImportJobsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"csv" | "json">("csv");
  const [csv, setCsv] = useState("");
  const [json, setJson] = useState("");
  const [platform, setPlatform] = useState("");
  const [analyze, setAnalyze] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const body: { csv?: string; rows?: unknown[]; platform?: string; analyze: boolean } = { analyze };
      if (platform.trim()) body.platform = platform.trim();
      if (mode === "csv") {
        if (!csv.trim()) throw new Error("Paste CSV rows first");
        body.csv = csv;
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          throw new Error("Invalid JSON");
        }
        const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown[] }).rows) ? (parsed as { rows: unknown[] }).rows : [parsed];
        if (!rows.length) throw new Error("No rows found");
        body.rows = rows;
      }
      const r = await api<{ created: string[]; updated: number }>("/api/jobs/import", { method: "POST", json: body });
      toast.success(`Imported ${r.created.length} new job(s)`, { description: `${r.updated} updated${analyze && r.created.length ? " · analysis queued" : ""}` });
      setOpen(false);
      setCsv("");
      setJson("");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="jobs-import">
        <Upload />
        Import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Import jobs" description="Paste CSV (header row required) or a JSON array of rows. Required: project_title, project_description." className="max-w-2xl">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "csv" | "json")}>
            <TabsList>
              <TabsTrigger value="csv">CSV</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="csv">
              <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={CSV_EXAMPLE} className="min-h-[220px] font-mono text-xs" data-testid="jobs-import-csv" />
            </TabsContent>
            <TabsContent value="json">
              <Textarea value={json} onChange={(e) => setJson(e.target.value)} placeholder={JSON_EXAMPLE} className="min-h-[220px] font-mono text-xs" data-testid="jobs-import-json" />
            </TabsContent>
          </Tabs>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <Field label="Platform key (optional)" className="w-48">
              <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="manual-import" className="h-8 text-xs" />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
              <Switch checked={analyze} onCheckedChange={setAnalyze} />
              Analyze after import
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} loading={busy} data-testid="jobs-import-submit">Import</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
