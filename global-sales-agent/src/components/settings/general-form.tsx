"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { KV } from "@/components/ui/misc";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export interface GeneralFormProps {
  appName: string;
  orgName: string;
  plan: string;
  planLabel: string;
  planLimits: { maxUsers: number; maxPlatformAccounts: number; maxProposalsPerDay: number; maxJobsPerDiscovery: number; aiDailyCostLimitUsd: number; automationRules: number; abTesting: boolean; fullAutomation: boolean };
  languages: readonly string[];
  languageNames: Record<string, string>;
  settings: {
    defaultLanguage: string;
    targetCountries: string[];
    targetCategories: string[];
    targetLanguages: string[];
    excludeKeywords: string[];
    businessHours: { start: string; end: string; timezone: string; days: number[]; restrictSending: boolean };
  };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMEZONES = ["Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Asia/Kolkata", "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Madrid", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Sao_Paulo", "Australia/Sydney", "UTC"];

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function GeneralForm(p: GeneralFormProps) {
  const router = useRouter();
  const [appName, setAppName] = useState(p.appName);
  const [name, setName] = useState(p.orgName);
  const [defaultLanguage, setDefaultLanguage] = useState(p.settings.defaultLanguage);
  const [countries, setCountries] = useState(p.settings.targetCountries.join(", "));
  const [categories, setCategories] = useState(p.settings.targetCategories.join(", "));
  const [langs, setLangs] = useState(p.settings.targetLanguages.join(", "));
  const [exclude, setExclude] = useState(p.settings.excludeKeywords.join(", "));
  const [bh, setBh] = useState(p.settings.businessHours);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!appName.trim() || !name.trim()) {
      toast.error("App name and organisation name are required");
      return;
    }
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        json: {
          appName: appName.trim(),
          name: name.trim(),
          settings: {
            defaultLanguage,
            targetCountries: splitList(countries).map((c) => c.toUpperCase()),
            targetCategories: splitList(categories),
            targetLanguages: splitList(langs).map((l) => l.toLowerCase()),
            excludeKeywords: splitList(exclude),
            businessHours: bh,
          },
        },
      });
      toast.success("Settings saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const toggleDay = (d: number) => setBh((b) => ({ ...b, days: b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d].sort() }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
            <CardDescription>The app name is shown in the sidebar and browser title — rename the system to match your brand.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="App name (system name)">
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={60} data-testid="settings-app-name" />
            </Field>
            <Field label="Organisation name">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-testid="settings-org-name" />
            </Field>
            <Field label="Default language" hint="Your own working language — proposals are written in the client's language and translated back to this.">
              <Select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} data-testid="settings-default-language">
                {p.languages.map((l) => (
                  <option key={l} value={l}>{p.languageNames[l] ?? l} ({l})</option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Targeting</CardTitle>
            <CardDescription>Comma-separated. Used by the Scout Agent and the Analyst to prioritise and filter jobs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Target countries" hint="ISO codes, e.g. US, GB, DE">
              <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="US, GB, DE, JP" data-testid="settings-target-countries" />
            </Field>
            <Field label="Target languages" hint="ISO 639-1 codes, e.g. en, ja">
              <Input value={langs} onChange={(e) => setLangs(e.target.value)} placeholder="en, ja, de" data-testid="settings-target-languages" />
            </Field>
            <Field label="Target categories">
              <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="web development, mobile apps, design" data-testid="settings-target-categories" />
            </Field>
            <Field label="Exclude keywords" hint="Jobs containing these are skipped">
              <Input value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="adult, gambling, crypto" data-testid="settings-exclude-keywords" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business hours</CardTitle>
            <CardDescription>When sending is restricted, automated proposals and replies are scheduled inside these hours.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start">
                <Input type="time" value={bh.start} onChange={(e) => setBh({ ...bh, start: e.target.value })} />
              </Field>
              <Field label="End">
                <Input type="time" value={bh.end} onChange={(e) => setBh({ ...bh, end: e.target.value })} />
              </Field>
              <Field label="Timezone">
                <Input list="tz-list" value={bh.timezone} onChange={(e) => setBh({ ...bh, timezone: e.target.value })} />
                <datalist id="tz-list">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Days</span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <label key={d} className={cn("flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors", bh.days.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                    <input type="checkbox" className="sr-only" checked={bh.days.includes(i)} onChange={() => toggleDay(i)} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={bh.restrictSending} onCheckedChange={(v) => setBh({ ...bh, restrictSending: v })} data-testid="settings-restrict-sending" />
              Restrict automated sending to business hours
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} loading={busy} data-testid="settings-save">
            <Save /> Save settings
          </Button>
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Plan <Badge variant="accent">{p.planLabel}</Badge>
          </CardTitle>
          <CardDescription>Limits enforced by the current plan.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <KV k="Users" v={p.planLimits.maxUsers} />
          <KV k="Platform accounts" v={p.planLimits.maxPlatformAccounts} />
          <KV k="Proposals / day" v={p.planLimits.maxProposalsPerDay} />
          <KV k="Jobs / discovery" v={p.planLimits.maxJobsPerDiscovery} />
          <KV k="AI daily cost cap" v={`$${p.planLimits.aiDailyCostLimitUsd}`} />
          <KV k="Automation rules" v={p.planLimits.automationRules} />
          <KV k="A/B testing" v={p.planLimits.abTesting ? "Included" : "Not included"} />
          <KV k="Full automation" v={p.planLimits.fullAutomation ? "Available" : "Not available"} />
        </CardContent>
      </Card>
    </div>
  );
}
