"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";

export interface Achievement { title: string; description?: string; metric?: string; category?: string }
export interface PortfolioItem { title: string; url?: string; description?: string; category?: string }
export interface CaseStudy { title: string; problem?: string; solution?: string; result?: string }
export interface FaqItem { q: string; a: string }

export interface ProfileData {
  companyName: string;
  tagline: string | null;
  services: string;
  strengths: string[];
  weaknesses: string[];
  capabilities: string[];
  priceRange: string | null;
  minimumOrderPrice: number;
  currency: string;
  hourlyRate: number | null;
  achievements: Achievement[];
  portfolio: PortfolioItem[];
  caseStudies: CaseStudy[];
  differentiators: string[];
  languages: string[];
  availableHours: string | null;
  typicalLeadTime: string | null;
  staffCount: number | null;
  techStack: string[];
  pastProjects: unknown[];
  faq: FaqItem[];
  forbiddenConditions: string[];
  excludeKeywords: string[];
  priorityKeywords: string[];
}

const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const join = (a: string[]) => a.join("\n");
const optNum = (s: string): number | null => (s.trim() === "" ? null : Number(s));
const clean = <T extends object>(rows: T[], key: keyof T) => rows.filter((r) => String(r[key] ?? "").trim() !== "").map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined && v !== "")) as T);

/** Multi-line textarea mapped to a string[] (one item per line). */
function ListField({ label, hint, value, onChange, testId }: { label: string; hint?: string; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <Field label={label} hint={hint ?? "One per line"}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[96px]" data-testid={testId} />
    </Field>
  );
}

/** Generic "rows of fields" editor used for achievements / portfolio / case studies / FAQ. */
function RowEditor<T extends object>({ rows, onChange, fields, empty, testId }: { rows: T[]; onChange: (rows: T[]) => void; fields: { key: keyof T & string; label: string; wide?: boolean }[]; empty: T; testId: string }) {
  const upd = (i: number, k: keyof T & string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const val = (row: T, k: keyof T & string) => String((row[k] as unknown) ?? "");
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      {rows.length === 0 ? <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">Nothing yet — add a row. Only registered items may be cited by the AI.</p> : null}
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} className={f.wide ? "sm:col-span-2" : undefined}>
              {f.wide ? <Textarea value={val(row, f.key)} onChange={(e) => upd(i, f.key, e.target.value)} className="min-h-[56px]" /> : <Input value={val(row, f.key)} onChange={(e) => upd(i, f.key, e.target.value)} />}
            </Field>
          ))}
          <div className="flex justify-end sm:col-span-2">
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button variant="outline" size="xs" onClick={() => onChange([...rows, { ...empty }])} data-testid={`${testId}-add`}>
          <Plus /> Add row
        </Button>
      </div>
    </div>
  );
}

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const router = useRouter();
  const [f, setF] = useState({
    companyName: initial.companyName,
    tagline: initial.tagline ?? "",
    services: initial.services,
    priceRange: initial.priceRange ?? "",
    minimumOrderPrice: String(initial.minimumOrderPrice),
    currency: initial.currency,
    hourlyRate: initial.hourlyRate === null ? "" : String(initial.hourlyRate),
    availableHours: initial.availableHours ?? "",
    typicalLeadTime: initial.typicalLeadTime ?? "",
    staffCount: initial.staffCount === null ? "" : String(initial.staffCount),
  });
  const [lists, setLists] = useState({
    strengths: join(initial.strengths),
    weaknesses: join(initial.weaknesses),
    capabilities: join(initial.capabilities),
    differentiators: join(initial.differentiators),
    languages: join(initial.languages),
    techStack: join(initial.techStack),
    forbiddenConditions: join(initial.forbiddenConditions),
    excludeKeywords: join(initial.excludeKeywords),
    priorityKeywords: join(initial.priorityKeywords),
  });
  const [achievements, setAchievements] = useState<Achievement[]>(initial.achievements);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(initial.portfolio);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>(initial.caseStudies);
  const [faq, setFaq] = useState<FaqItem[]>(initial.faq);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const setL = (k: keyof typeof lists) => (v: string) => setLists((l) => ({ ...l, [k]: v }));

  async function save() {
    if (!f.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setBusy(true);
    const hourlyRate = optNum(f.hourlyRate);
    const staffCount = optNum(f.staffCount);
    const body = {
      companyName: f.companyName.trim(),
      tagline: f.tagline.trim() || null,
      services: f.services,
      strengths: lines(lists.strengths),
      weaknesses: lines(lists.weaknesses),
      capabilities: lines(lists.capabilities),
      priceRange: f.priceRange.trim() || null,
      minimumOrderPrice: Number(f.minimumOrderPrice) || 0,
      currency: f.currency.trim().toUpperCase() || "USD",
      ...(hourlyRate !== null && !Number.isNaN(hourlyRate) ? { hourlyRate } : { hourlyRate: null }),
      achievements: clean(achievements, "title"),
      portfolio: clean(portfolio, "title"),
      caseStudies: clean(caseStudies, "title"),
      differentiators: lines(lists.differentiators),
      languages: lines(lists.languages),
      availableHours: f.availableHours.trim() || null,
      typicalLeadTime: f.typicalLeadTime.trim() || null,
      ...(staffCount !== null && !Number.isNaN(staffCount) ? { staffCount: Math.round(staffCount) } : { staffCount: null }),
      techStack: lines(lists.techStack),
      pastProjects: initial.pastProjects,
      faq: faq.filter((x) => x.q.trim()).map((x) => ({ q: x.q, a: x.a ?? "" })),
      forbiddenConditions: lines(lists.forbiddenConditions),
      excludeKeywords: lines(lists.excludeKeywords),
      priorityKeywords: lines(lists.priorityKeywords),
    };
    try {
      await api("/api/settings/profile", { method: "PUT", json: body });
      toast.success("Company profile saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="profile-form">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>The single source of truth for every agent. The AI only cites what is registered here — nothing is invented.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input value={f.companyName} onChange={set("companyName")} data-testid="profile-company-name" />
          </Field>
          <Field label="Tagline">
            <Input value={f.tagline} onChange={set("tagline")} placeholder="One line that describes you" />
          </Field>
          <Field label="Services" className="sm:col-span-2" hint="What you sell, in your own words. Used in every proposal.">
            <Textarea value={f.services} onChange={set("services")} className="min-h-[96px]" data-testid="profile-services" />
          </Field>
          <Field label="Price range (text)">
            <Input value={f.priceRange} onChange={set("priceRange")} placeholder="e.g. $2,000 – $20,000 per project" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Minimum order">
              <Input type="number" min={0} value={f.minimumOrderPrice} onChange={set("minimumOrderPrice")} data-testid="profile-min-order" />
            </Field>
            <Field label="Currency">
              <Input value={f.currency} onChange={set("currency")} maxLength={3} />
            </Field>
            <Field label="Hourly rate">
              <Input type="number" min={0} value={f.hourlyRate} onChange={set("hourlyRate")} />
            </Field>
          </div>
          <Field label="Available hours">
            <Input value={f.availableHours} onChange={set("availableHours")} placeholder="e.g. Mon–Fri 9:00–18:00 JST" />
          </Field>
          <Field label="Typical lead time">
            <Input value={f.typicalLeadTime} onChange={set("typicalLeadTime")} placeholder="e.g. 2–4 weeks" />
          </Field>
          <Field label="Staff count">
            <Input type="number" min={0} step={1} value={f.staffCount} onChange={set("staffCount")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positioning</CardTitle>
          <CardDescription>Strengths, capabilities and differentiators shape fit scoring and proposal content.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ListField label="Strengths" value={lists.strengths} onChange={setL("strengths")} testId="profile-strengths" />
          <ListField label="Weaknesses" hint="One per line — helps the Analyst avoid poor-fit jobs" value={lists.weaknesses} onChange={setL("weaknesses")} testId="profile-weaknesses" />
          <ListField label="Capabilities" value={lists.capabilities} onChange={setL("capabilities")} testId="profile-capabilities" />
          <ListField label="Differentiators" value={lists.differentiators} onChange={setL("differentiators")} testId="profile-differentiators" />
          <ListField label="Languages you can work in" hint="One per line, e.g. English, 日本語" value={lists.languages} onChange={setL("languages")} testId="profile-languages" />
          <ListField label="Tech stack" value={lists.techStack} onChange={setL("techStack")} testId="profile-techStack" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job filters</CardTitle>
          <CardDescription>Applied during analysis: forbidden conditions raise risk, exclude keywords skip jobs, priority keywords boost fit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <ListField label="Forbidden conditions" hint="e.g. unpaid trial, revenue share" value={lists.forbiddenConditions} onChange={setL("forbiddenConditions")} testId="profile-forbiddenConditions" />
          <ListField label="Exclude keywords" value={lists.excludeKeywords} onChange={setL("excludeKeywords")} testId="profile-excludeKeywords" />
          <ListField label="Priority keywords" value={lists.priorityKeywords} onChange={setL("priorityKeywords")} testId="profile-priorityKeywords" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>Verified results the AI may reference.</CardDescription>
        </CardHeader>
        <CardContent>
          <RowEditor<Achievement> rows={achievements} onChange={setAchievements} testId="profile-achievements" empty={{ title: "", description: "", metric: "", category: "" }} fields={[{ key: "title", label: "Title" }, { key: "metric", label: "Metric (e.g. +38% conversions)" }, { key: "category", label: "Category" }, { key: "description", label: "Description", wide: true }]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
          <CardDescription>Public work samples — only these URLs are ever included in proposals.</CardDescription>
        </CardHeader>
        <CardContent>
          <RowEditor<PortfolioItem> rows={portfolio} onChange={setPortfolio} testId="profile-portfolio" empty={{ title: "", url: "", description: "", category: "" }} fields={[{ key: "title", label: "Title" }, { key: "url", label: "URL" }, { key: "category", label: "Category" }, { key: "description", label: "Description", wide: true }]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Case studies</CardTitle>
          <CardDescription>Problem → solution → result stories used in the “similar experience” section.</CardDescription>
        </CardHeader>
        <CardContent>
          <RowEditor<CaseStudy> rows={caseStudies} onChange={setCaseStudies} testId="profile-case-studies" empty={{ title: "", problem: "", solution: "", result: "" }} fields={[{ key: "title", label: "Title", wide: true }, { key: "problem", label: "Problem", wide: true }, { key: "solution", label: "Solution", wide: true }, { key: "result", label: "Result", wide: true }]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
          <CardDescription>Answers the Reply Agent may reuse when clients ask common questions.</CardDescription>
        </CardHeader>
        <CardContent>
          <RowEditor<FaqItem> rows={faq} onChange={setFaq} testId="profile-faq" empty={{ q: "", a: "" }} fields={[{ key: "q", label: "Question", wide: true }, { key: "a", label: "Answer", wide: true }]} />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} loading={busy} data-testid="profile-save" className="shadow-lg">
          <Save /> Save profile
        </Button>
      </div>
    </div>
  );
}
