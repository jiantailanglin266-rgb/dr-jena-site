"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Plug, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/misc";
import { api } from "@/lib/client-api";
import { formatDateTime, timeAgo } from "@/lib/utils";

export interface PlatformCardData {
  key: string;
  displayName: string;
  website: string | null;
  termsUrl: string | null;
  officialApi: boolean;
  automatedSendingPolicy: string;
  defaultSendMode: "AUTO" | "MANUAL_APPROVAL" | "MANUAL_ONLY";
  complianceNotes: string;
  supportedLanguages: string[];
  capabilities: { discover: boolean; sendProposal: boolean; fetchReplies: boolean; webhook: boolean };
  credentialFields: { key: string; label: string; secret?: boolean }[];
  account: { label: string; enabled: boolean; sendMode: "AUTO" | "MANUAL_APPROVAL" | "MANUAL_ONLY"; config: unknown; credentials: Record<string, string>; lastDiscoveryAt: string | null; lastReplyPollAt: string | null } | null;
  limits: { dailyLimit: number; hourlyLimit: number; maxContactsPerClientPerWeek: number };
}

const SEND_MODES = ["AUTO", "MANUAL_APPROVAL", "MANUAL_ONLY"] as const;
const SEND_MODE_HELP: Record<string, string> = {
  AUTO: "Approved proposals are sent by the connector without a person.",
  MANUAL_APPROVAL: "A person approves each proposal; the connector then sends it.",
  MANUAL_ONLY: "The system prepares text; a person copies it into the platform.",
};

export function PlatformCard({ p }: { p: PlatformCardData }) {
  const router = useRouter();
  const autoAllowed = p.automatedSendingPolicy !== "PROHIBITED" && p.capabilities.sendProposal;
  const [enabled, setEnabled] = useState(p.account?.enabled ?? false);
  const [sendMode, setSendMode] = useState<(typeof SEND_MODES)[number]>(p.account?.sendMode ?? p.defaultSendMode);
  const [label, setLabel] = useState(p.account?.label ?? p.displayName);
  const [creds, setCreds] = useState<Record<string, string>>(() => Object.fromEntries(p.credentialFields.map((f) => [f.key, p.account?.credentials?.[f.key] ?? ""])));
  const [config, setConfig] = useState(() => JSON.stringify(p.account?.config ?? {}, null, 2));
  const [limits, setLimits] = useState({ dailyLimit: String(p.limits.dailyLimit), hourlyLimit: String(p.limits.hourlyLimit), maxContactsPerClientPerWeek: String(p.limits.maxContactsPerClientPerWeek) });
  const [busy, setBusy] = useState<"save" | "test" | "limits" | "toggle" | null>(null);
  const isGeneric = p.key === "generic-api";

  function parseConfig(): Record<string, unknown> | null {
    try {
      const v = JSON.parse(config || "{}");
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Config must be a JSON object");
      return v as Record<string, unknown>;
    } catch (e) {
      toast.error(e instanceof Error ? `Config JSON: ${e.message}` : "Invalid config JSON");
      return null;
    }
  }

  async function save() {
    let cfg: Record<string, unknown> | undefined;
    if (isGeneric) {
      const parsed = parseConfig();
      if (!parsed) return;
      cfg = parsed;
    }
    setBusy("save");
    try {
      await api("/api/settings/platforms", { method: "PATCH", json: { platformKey: p.key, label: label.trim() || p.displayName, enabled, sendMode, credentials: creds, ...(cfg ? { config: cfg } : {}) } });
      toast.success(`${p.displayName} saved`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(next: boolean) {
    setEnabled(next);
    setBusy("toggle");
    try {
      await api("/api/settings/platforms", { method: "PATCH", json: { platformKey: p.key, enabled: next, ...(p.account ? {} : { sendMode }) } });
      toast.success(`${p.displayName} ${next ? "enabled" : "disabled"}`);
      router.refresh();
    } catch (e) {
      setEnabled(!next);
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const r = await api<{ ok: boolean; message: string }>(`/api/settings/platforms/${p.key}/test`, { method: "POST", json: {} });
      if (r.ok) toast.success(`${p.displayName}: connection OK`, { description: r.message });
      else toast.error(`${p.displayName}: connection failed`, { description: r.message });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveLimits() {
    setBusy("limits");
    try {
      await api(`/api/settings/platforms/${p.key}/limits`, { method: "PUT", json: { dailyLimit: Number(limits.dailyLimit) || 0, hourlyLimit: Number(limits.hourlyLimit) || 0, maxContactsPerClientPerWeek: Number(limits.maxContactsPerClientPerWeek) || 0 } });
      toast.success(`${p.displayName} limits saved`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  const cap = (ok: boolean, name: string) => (
    <Badge variant={ok ? "success" : "outline"} className={ok ? "" : "text-muted-foreground line-through"}>{name}</Badge>
  );

  return (
    <Card data-testid={`platform-card-${p.key}`}>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {p.displayName}
            {p.website ? (
              <a href={p.website} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" title={p.website}>
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            {p.account ? <Badge variant={enabled ? "success" : "secondary"}>{enabled ? "connected" : "disabled"}</Badge> : <Badge variant="outline">not configured</Badge>}
          </CardTitle>
          <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={p.officialApi ? "success" : "warning"}>{p.officialApi ? "Official API" : "No official API"}</Badge>
            <span className="text-muted-foreground">Automated sending:</span>
            <StatusBadge status={p.automatedSendingPolicy} />
            {p.termsUrl ? (
              <a href={p.termsUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Terms</a>
            ) : null}
          </CardDescription>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs">
          <span className="text-muted-foreground">Enabled</span>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={busy === "toggle"} data-testid={`platform-enabled-${p.key}`} />
        </label>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {p.complianceNotes ? <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{p.complianceNotes}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Capabilities:</span>
          {cap(p.capabilities.discover, "discover")}
          {cap(p.capabilities.sendProposal, "send")}
          {cap(p.capabilities.fetchReplies, "replies")}
          {cap(p.capabilities.webhook, "webhook")}
          {p.supportedLanguages.length ? <span className="ml-2 text-muted-foreground">Languages: {p.supportedLanguages.join(", ")}</span> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Send mode" hint={SEND_MODE_HELP[sendMode]}>
            <Select value={sendMode} onChange={(e) => setSendMode(e.target.value as (typeof SEND_MODES)[number])} data-testid={`platform-send-mode-${p.key}`}>
              {SEND_MODES.map((m) => (
                <option key={m} value={m} disabled={m === "AUTO" && !autoAllowed}>
                  {m.replace(/_/g, " ")}{m === "AUTO" && !autoAllowed ? " — not allowed on this platform" : ""}
                </option>
              ))}
            </Select>
          </Field>
          {p.credentialFields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.secret ? "Stored encrypted. Leave the masked value to keep the current secret." : undefined}>
              <Input type={f.secret ? "password" : "text"} value={creds[f.key] ?? ""} onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })} autoComplete="off" data-testid={`platform-cred-${p.key}-${f.key}`} />
            </Field>
          ))}
          {isGeneric ? (
            <Field label="Config (JSON)" className="sm:col-span-2" hint="Endpoint, field mapping, headers — see connector docs.">
              <Textarea value={config} onChange={(e) => setConfig(e.target.value)} className="min-h-[120px] font-mono text-xs" data-testid={`platform-config-${p.key}`} />
            </Field>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} loading={busy === "save"} data-testid={`platform-save-${p.key}`}>
            <Save /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={test} loading={busy === "test"} data-testid={`platform-test-${p.key}`}>
            <Plug /> Test connection
          </Button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            Last discovery: <span title={p.account?.lastDiscoveryAt ? formatDateTime(p.account.lastDiscoveryAt) : undefined}>{p.account?.lastDiscoveryAt ? timeAgo(p.account.lastDiscoveryAt) : "never"}</span>
            {" · "}
            Last poll: <span title={p.account?.lastReplyPollAt ? formatDateTime(p.account.lastReplyPollAt) : undefined}>{p.account?.lastReplyPollAt ? timeAgo(p.account.lastReplyPollAt) : "never"}</span>
          </span>
        </div>

        <Separator />

        <div>
          <p className="mb-2 text-xs font-medium">Sending limits</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Field label="Per day">
              <Input type="number" min={0} value={limits.dailyLimit} onChange={(e) => setLimits({ ...limits, dailyLimit: e.target.value })} data-testid={`platform-limit-daily-${p.key}`} />
            </Field>
            <Field label="Per hour">
              <Input type="number" min={0} value={limits.hourlyLimit} onChange={(e) => setLimits({ ...limits, hourlyLimit: e.target.value })} data-testid={`platform-limit-hourly-${p.key}`} />
            </Field>
            <Field label="Per client / week">
              <Input type="number" min={0} value={limits.maxContactsPerClientPerWeek} onChange={(e) => setLimits({ ...limits, maxContactsPerClientPerWeek: e.target.value })} data-testid={`platform-limit-client-${p.key}`} />
            </Field>
            <Button size="sm" variant="outline" onClick={saveLimits} loading={busy === "limits"} data-testid={`platform-save-limits-${p.key}`}>Save limits</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
