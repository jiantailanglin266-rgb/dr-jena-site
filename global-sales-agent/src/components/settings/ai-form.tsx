"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client-api";

export interface AiFormProps {
  providers: { anthropic: boolean; openai: boolean; demo: boolean };
  planLimits: { aiDailyCostLimitUsd: number; fullAutomation: boolean; abTesting: boolean };
  tones: readonly string[];
  lengths: readonly string[];
  levels: readonly string[];
  settings: {
    aiProvider: "auto" | "anthropic" | "openai" | "mock";
    aiModel: string;
    temperature: number;
    salesTone: string;
    defaultProposalLength: string;
    automationLevel: string;
    autoSendEnabled: boolean;
    requireHumanApprovalForWon: boolean;
    requireHumanApprovalForPrice: boolean;
    minJobBudgetUsd: number;
    minOpportunityScore: number;
    aiDailyCostLimitUsd: number;
    aiMonthlyCostLimitUsd: number;
    pricing: { minimumPrice: number; targetPrice: number; idealPrice: number; maximumDiscountPct: number; currency: string; hourlyRate: number };
    abTesting: { enabled: boolean; variantBSharePct: number };
  };
}

const LEVEL_HELP: Record<string, string> = {
  MANUAL: "AI analyses and drafts only. Every proposal, reply and stage change is done by a person.",
  ASSISTED: "AI drafts proposals and replies; a person approves each one before it is sent.",
  SEMI_AUTO: "AI can send proposals automatically on platforms with send mode AUTO (when auto-send is on). Replies still need approval.",
  FULL_AUTO: "AI runs the whole pipeline: proposals, replies and negotiation within pricing limits. Business plan or higher.",
};

const num = (v: string, fallback = 0) => (v.trim() === "" ? fallback : Number(v));

export function AiForm(p: AiFormProps) {
  const router = useRouter();
  const s0 = p.settings;
  const [provider, setProvider] = useState(s0.aiProvider);
  const [model, setModel] = useState(s0.aiModel);
  const [temperature, setTemperature] = useState(s0.temperature);
  const [tone, setTone] = useState(s0.salesTone);
  const [length, setLength] = useState(s0.defaultProposalLength);
  const [level, setLevel] = useState(s0.automationLevel);
  const [autoSend, setAutoSend] = useState(s0.autoSendEnabled);
  const [won, setWon] = useState(s0.requireHumanApprovalForWon);
  const [price, setPrice] = useState(s0.requireHumanApprovalForPrice);
  const [minBudget, setMinBudget] = useState(String(s0.minJobBudgetUsd));
  const [minScore, setMinScore] = useState(String(s0.minOpportunityScore));
  const [daily, setDaily] = useState(String(s0.aiDailyCostLimitUsd));
  const [monthly, setMonthly] = useState(String(s0.aiMonthlyCostLimitUsd));
  const [pr, setPr] = useState({ minimumPrice: String(s0.pricing.minimumPrice), targetPrice: String(s0.pricing.targetPrice), idealPrice: String(s0.pricing.idealPrice), maximumDiscountPct: String(s0.pricing.maximumDiscountPct), currency: s0.pricing.currency, hourlyRate: String(s0.pricing.hourlyRate) });
  const [ab, setAb] = useState({ enabled: s0.abTesting.enabled, share: String(s0.abTesting.variantBSharePct) });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        json: {
          settings: {
            aiProvider: provider,
            aiModel: model.trim(),
            temperature,
            salesTone: tone,
            defaultProposalLength: length,
            automationLevel: level,
            autoSendEnabled: autoSend,
            requireHumanApprovalForWon: won,
            requireHumanApprovalForPrice: price,
            minJobBudgetUsd: num(minBudget),
            minOpportunityScore: num(minScore),
            aiDailyCostLimitUsd: num(daily),
            aiMonthlyCostLimitUsd: num(monthly),
            pricing: { minimumPrice: num(pr.minimumPrice), targetPrice: num(pr.targetPrice), idealPrice: num(pr.idealPrice), maximumDiscountPct: num(pr.maximumDiscountPct), currency: pr.currency.trim().toUpperCase() || "USD", hourlyRate: num(pr.hourlyRate) },
            abTesting: { enabled: ab.enabled, variantBSharePct: num(ab.share, 30) },
          },
        },
      });
      toast.success("AI settings saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const keyBadge = (ok: boolean, label: string) => <Badge variant={ok ? "success" : "outline"}>{label}: {ok ? "key configured" : "no key"}</Badge>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Model</CardTitle>
            <CardDescription>Provider and model used by all agents. Keys are read from the server environment.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {keyBadge(p.providers.anthropic, "Anthropic")}
              {keyBadge(p.providers.openai, "OpenAI")}
              {p.providers.demo ? <Badge variant="warning">Demo mode (mock provider)</Badge> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Provider" hint="auto = Anthropic → OpenAI → mock, whichever has a key">
                <Select value={provider} onChange={(e) => setProvider(e.target.value as AiFormProps["settings"]["aiProvider"])} data-testid="ai-provider">
                  <option value="auto">auto</option>
                  <option value="anthropic">anthropic{p.providers.anthropic ? "" : " (no key)"}</option>
                  <option value="openai">openai{p.providers.openai ? "" : " (no key)"}</option>
                  <option value="mock">mock (offline)</option>
                </Select>
              </Field>
              <Field label="Model" hint="Leave empty for the provider default">
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. claude-sonnet-4-5 / gpt-4o" data-testid="ai-model" />
              </Field>
            </div>
            <Field label={`Temperature · ${temperature.toFixed(2)}`} hint="Lower = more consistent, higher = more creative">
              <input type="range" min={0} max={1} step={0.05} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-[var(--accent)]" data-testid="ai-temperature" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sales tone">
                <Select value={tone} onChange={(e) => setTone(e.target.value)} data-testid="ai-tone">
                  {p.tones.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Default proposal length">
                <Select value={length} onChange={(e) => setLength(e.target.value)} data-testid="ai-length">
                  {p.lengths.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automation</CardTitle>
            <CardDescription>How much the agents may do without a person in the loop.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Automation level" hint={LEVEL_HELP[level]}>
              <Select value={level} onChange={(e) => setLevel(e.target.value)} data-testid="ai-automation-level">
                {p.levels.map((l) => (
                  <option key={l} value={l} disabled={l === "FULL_AUTO" && !p.planLimits.fullAutomation}>
                    {l.replace(/_/g, " ")}{l === "FULL_AUTO" && !p.planLimits.fullAutomation ? " (upgrade plan)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-start gap-3 text-xs">
              <Switch checked={autoSend} onCheckedChange={setAutoSend} data-testid="ai-auto-send" />
              <span>
                <span className="font-medium">Auto-send enabled</span>
                <br />
                <span className="text-muted-foreground">Only takes effect at SEMI_AUTO or above and on platforms whose send mode is AUTO. Compliance-blocked proposals are never sent.</span>
              </span>
            </label>
            <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs">
              <p className="mb-2 flex items-center gap-1.5 font-medium text-success"><ShieldCheck className="size-3.5" /> Human-in-the-loop guarantees</p>
              <label className="flex items-center gap-2 py-1">
                <Switch checked={won} onCheckedChange={setWon} data-testid="ai-approval-won" />
                Require human approval to mark a deal WON
              </label>
              <label className="flex items-center gap-2 py-1">
                <Switch checked={price} onCheckedChange={setPrice} data-testid="ai-approval-price" />
                Require human approval for price changes / quotes
              </label>
              <p className="mt-1 text-muted-foreground">When enabled, the AI can only prepare a Deal Summary or a quote — a person confirms it. Rules and agents cannot set WON directly.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Min job budget (USD)" hint="Jobs below this are not qualified">
                <Input type="number" min={0} value={minBudget} onChange={(e) => setMinBudget(e.target.value)} data-testid="ai-min-budget" />
              </Field>
              <Field label="Min opportunity score" hint="0–100">
                <Input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} data-testid="ai-min-score" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing limits</CardTitle>
            <CardDescription>The Pricing Engine never offers below the minimum; the Negotiation Agent works between target and ideal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Minimum price (floor)">
              <Input type="number" min={0} value={pr.minimumPrice} onChange={(e) => setPr({ ...pr, minimumPrice: e.target.value })} data-testid="ai-min-price" />
            </Field>
            <Field label="Target price">
              <Input type="number" min={0} value={pr.targetPrice} onChange={(e) => setPr({ ...pr, targetPrice: e.target.value })} />
            </Field>
            <Field label="Ideal price">
              <Input type="number" min={0} value={pr.idealPrice} onChange={(e) => setPr({ ...pr, idealPrice: e.target.value })} />
            </Field>
            <Field label="Max discount %">
              <Input type="number" min={0} max={90} value={pr.maximumDiscountPct} onChange={(e) => setPr({ ...pr, maximumDiscountPct: e.target.value })} />
            </Field>
            <Field label="Currency">
              <Input value={pr.currency} onChange={(e) => setPr({ ...pr, currency: e.target.value })} maxLength={3} />
            </Field>
            <Field label="Hourly rate">
              <Input type="number" min={0} value={pr.hourlyRate} onChange={(e) => setPr({ ...pr, hourlyRate: e.target.value })} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost limits & A/B testing</CardTitle>
            <CardDescription>AI calls stop when a limit is reached. Plan cap for daily spend: ${p.planLimits.aiDailyCostLimitUsd}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Daily AI cost limit (USD)">
                <Input type="number" min={0} max={p.planLimits.aiDailyCostLimitUsd} value={daily} onChange={(e) => setDaily(e.target.value)} data-testid="ai-daily-limit" />
              </Field>
              <Field label="Monthly AI cost limit (USD)">
                <Input type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} data-testid="ai-monthly-limit" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={ab.enabled} onCheckedChange={(v) => setAb({ ...ab, enabled: v })} disabled={!p.planLimits.abTesting} data-testid="ai-ab-enabled" />
              Enable A/B testing of proposal variants{p.planLimits.abTesting ? "" : " (Pro plan or higher)"}
            </label>
            <Field label="Variant B share %" hint="Share of proposals generated with the alternative variant">
              <Input type="number" min={0} max={100} value={ab.share} onChange={(e) => setAb({ ...ab, share: e.target.value })} disabled={!ab.enabled} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={busy} data-testid="ai-save">
          <Save /> Save AI settings
        </Button>
      </div>
    </div>
  );
}
