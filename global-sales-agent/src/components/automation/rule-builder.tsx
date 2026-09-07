"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, FlaskConical, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/misc";
import { api } from "@/lib/client-api";
import { CONDITION_FIELDS, conditionOps, type Condition, type ConditionOp } from "@/lib/automation/conditions";
import { ACTION_LABELS, actionTypes, type Action, type ActionType } from "@/lib/automation/actions";

export const RULE_TRIGGERS = ["JOB_ANALYZED", "JOB_QUALIFIED", "PROPOSAL_DRAFTED", "REPLY_RECEIVED", "REPLY_ANALYZED", "QUOTE_REQUESTED", "VERBAL_ACCEPT", "SCHEDULE"] as const;
export type RuleTrigger = (typeof RULE_TRIGGERS)[number];

const LEAD_STATUSES = ["DISCOVERED", "QUALIFIED", "PROPOSAL_CREATED", "PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT", "LOST"];

const OP_LABELS: Record<ConditionOp, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", neq: "≠", in: "in", not_in: "not in", contains: "contains", not_contains: "not contains", exists: "exists" };

export interface RuleFormData {
  id?: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  trigger: RuleTrigger;
  conditions: Condition[];
  actions: Action[];
  stopOnMatch: boolean;
}

export interface RuleBuilderOptions {
  tones: readonly string[];
  lengths: readonly string[];
}

type FlatCondition = { field: string; op: ConditionOp; value?: unknown };
type CondRow = { id: number; field: string; op: ConditionOp; text: string };
type ActRow = { id: number; type: ActionType; params: Record<string, string> };

let seq = 1;
const nextId = () => seq++;

function isFlat(c: Condition): c is FlatCondition {
  return "field" in c;
}

function fieldMeta(field: string) {
  return CONDITION_FIELDS.find((f) => f.field === field);
}

function toText(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v);
}

function parseValue(row: CondRow): unknown {
  const meta = fieldMeta(row.field);
  const type = meta?.type ?? "string";
  if (row.op === "exists") return undefined;
  if (row.op === "in" || row.op === "not_in") {
    const parts = row.text.split(",").map((s) => s.trim()).filter(Boolean);
    return type === "number" ? parts.map(Number).filter((n) => !Number.isNaN(n)) : parts;
  }
  if (type === "number") return row.text.trim() === "" ? undefined : Number(row.text);
  if (type === "boolean") return row.text === "true";
  return row.text;
}

function rowsFromConditions(conds: Condition[]): CondRow[] {
  return conds.filter(isFlat).map((c) => ({ id: nextId(), field: c.field, op: c.op, text: toText(c.value) }));
}

function rowsFromActions(actions: Action[]): ActRow[] {
  return actions.map((a) => ({ id: nextId(), type: a.type, params: Object.fromEntries(Object.entries(a.params ?? {}).map(([k, v]) => [k, toText(v)])) }));
}

function buildActionParams(row: ActRow): Record<string, unknown> {
  const p = row.params;
  const pick = (...keys: string[]) => Object.fromEntries(keys.filter((k) => p[k] !== undefined && p[k] !== "").map((k) => [k, p[k]]));
  switch (row.type) {
    case "CREATE_PROPOSAL":
      return pick("length", "tone", "variant");
    case "SET_LEAD_STATUS":
      return pick("status");
    case "CREATE_TASK":
    case "REQUEST_HUMAN_APPROVAL":
      return pick("title", "reason");
    case "EXCLUDE_JOB":
      return pick("reason");
    case "NOTIFY":
      return pick("message");
    case "GENERATE_REPLY":
      return pick("instruction");
    default:
      return {};
  }
}

const EMPTY: RuleFormData = { name: "", description: "", enabled: true, priority: 100, trigger: "JOB_ANALYZED", conditions: [], actions: [{ type: "CREATE_TASK", params: { title: "Review" } }], stopOnMatch: false };

export function RuleBuilderDialog({ open, onOpenChange, initial, options }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: RuleFormData | null; options: RuleBuilderOptions }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial?.id ? "Edit rule" : "New automation rule"} description="When a trigger fires and every condition matches, the actions run in order. WON and price approvals always stay with a human." className="max-h-[92vh] max-w-3xl overflow-y-auto" data-testid="rule-builder">
        {/* Radix unmounts the content when closed, so the form state resets on every open. */}
        <RuleBuilderForm initial={initial ?? EMPTY} options={options} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RuleBuilderForm({ initial, options, onClose }: { initial: RuleFormData; options: RuleBuilderOptions; onClose: () => void }) {
  const router = useRouter();
  const src = initial;
  const [name, setName] = useState(src.name);
  const [description, setDescription] = useState(src.description ?? "");
  const [trigger, setTrigger] = useState<RuleTrigger>(src.trigger);
  const [priority, setPriority] = useState(String(src.priority));
  const [enabled, setEnabled] = useState(src.enabled);
  const [stopOnMatch, setStopOnMatch] = useState(src.stopOnMatch);
  const [conds, setConds] = useState<CondRow[]>(() => rowsFromConditions(src.conditions));
  const [acts, setActs] = useState<ActRow[]>(() => rowsFromActions(src.actions));
  const [busy, setBusy] = useState<"save" | "dry" | null>(null);
  const [dry, setDry] = useState<{ evaluated: number; matched: number; samples: { id: string; title: string; score?: number | null }[] } | null>(null);
  // Nested any/all groups are not editable in the builder; they are preserved as-is on save.
  const nested = useMemo(() => src.conditions.filter((c) => !isFlat(c)), [src.conditions]);

  function conditionsPayload(): Condition[] {
    return [...conds.filter((c) => c.field).map((c) => ({ field: c.field, op: c.op, ...(c.op === "exists" ? {} : { value: parseValue(c) }) })), ...nested];
  }

  function actionsPayload(): Action[] {
    return acts.map((a) => ({ type: a.type, params: buildActionParams(a) }));
  }

  async function dryRun() {
    setBusy("dry");
    try {
      const r = await api<{ evaluated: number; matched: number; samples: { id: string; title: string; score?: number | null }[] }>("/api/automation/rules/dry-run", { method: "POST", json: { conditions: conditionsPayload() } });
      setDry(r);
      toast.success(`Dry run: matched ${r.matched} of ${r.evaluated} analysed jobs`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dry run failed");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    const actions = actionsPayload();
    if (actions.length === 0) {
      toast.error("Add at least one action");
      return;
    }
    setBusy("save");
    const payload = { name: name.trim(), description: description.trim() || null, enabled, priority: Number(priority) || 100, trigger, conditions: conditionsPayload(), actions, stopOnMatch };
    try {
      if (src.id) await api(`/api/automation/rules/${src.id}`, { method: "PATCH", json: payload });
      else await api("/api/automation/rules", { method: "POST", json: payload });
      toast.success(src.id ? "Rule updated" : "Rule created");
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  const updCond = (id: number, patch: Partial<CondRow>) => setConds((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updAct = (id: number, patch: Partial<ActRow>) => setActs((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updParam = (id: number, key: string, value: string) => setActs((rows) => rows.map((r) => (r.id === id ? { ...r, params: { ...r.params, [key]: value } } : r)));

  return (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Auto-propose high fit jobs" data-testid="rule-name" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[56px]" placeholder="Optional — what this rule is for" />
            </Field>
            <Field label="Trigger">
              <Select value={trigger} onChange={(e) => setTrigger(e.target.value as RuleTrigger)} data-testid="rule-trigger">
                {RULE_TRIGGERS.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" hint="Higher runs first">
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </Field>
          </div>

          <Separator />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Conditions</p>
                <p className="text-[11px] text-muted-foreground">All conditions must match (AND). Leave empty to always match.</p>
              </div>
              <Button variant="outline" size="xs" onClick={() => setConds((r) => [...r, { id: nextId(), field: CONDITION_FIELDS[0].field, op: "gte", text: "" }])} data-testid="rule-add-condition">
                <Plus /> Add condition
              </Button>
            </div>
            {conds.length === 0 ? <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">No conditions — the rule matches every {trigger.replace(/_/g, " ").toLowerCase()} event.</p> : null}
            {conds.map((row) => {
              const meta = fieldMeta(row.field);
              const type = meta?.type ?? "string";
              const isList = row.op === "in" || row.op === "not_in";
              return (
                <div key={row.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2" data-testid="rule-condition-row">
                  <Select value={row.field} onChange={(e) => updCond(row.id, { field: e.target.value, text: "" })} data-testid="rule-condition-field">
                    {CONDITION_FIELDS.map((f) => (
                      <option key={f.field} value={f.field}>{f.label}</option>
                    ))}
                  </Select>
                  <Select value={row.op} onChange={(e) => updCond(row.id, { op: e.target.value as ConditionOp })} className="w-32" data-testid="rule-condition-op">
                    {conditionOps.map((op) => (
                      <option key={op} value={op}>{OP_LABELS[op]}</option>
                    ))}
                  </Select>
                  {row.op === "exists" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : isList ? (
                    <Input value={row.text} onChange={(e) => updCond(row.id, { text: e.target.value })} placeholder="comma-separated values" data-testid="rule-condition-value" />
                  ) : type === "number" ? (
                    <Input type="number" value={row.text} onChange={(e) => updCond(row.id, { text: e.target.value })} placeholder="0" data-testid="rule-condition-value" />
                  ) : type === "boolean" ? (
                    <Select value={row.text || "true"} onChange={(e) => updCond(row.id, { text: e.target.value })} data-testid="rule-condition-value">
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </Select>
                  ) : type === "enum" && meta?.options ? (
                    <Select value={row.text || meta.options[0]} onChange={(e) => updCond(row.id, { text: e.target.value })} data-testid="rule-condition-value">
                      {meta.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={row.text} onChange={(e) => updCond(row.id, { text: e.target.value })} placeholder="value" data-testid="rule-condition-value" />
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setConds((r) => r.filter((x) => x.id !== row.id))} title="Remove">
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
            {nested.length > 0 ? <p className="text-[11px] text-muted-foreground">{nested.length} nested group(s) (any/all) kept as-is — edit via API.</p> : null}
            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" size="xs" onClick={dryRun} loading={busy === "dry"} data-testid="rule-dry-run">
                <FlaskConical /> Dry run
              </Button>
              {dry ? (
                <span className="text-xs text-muted-foreground" data-testid="rule-dry-run-result">
                  Matched <span className="font-semibold text-foreground">{dry.matched}</span> of {dry.evaluated} analysed jobs
                </span>
              ) : null}
            </div>
            {dry && dry.samples.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
                {dry.samples.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{s.title}</span>
                    {typeof s.score === "number" ? <Badge variant="outline">{s.score}</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Actions</p>
                <p className="text-[11px] text-muted-foreground">Executed in order when the rule matches.</p>
              </div>
              <Button variant="outline" size="xs" onClick={() => setActs((r) => [...r, { id: nextId(), type: "CREATE_TASK", params: {} }])} data-testid="rule-add-action">
                <Plus /> Add action
              </Button>
            </div>
            {acts.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3" data-testid="rule-action-row">
                <div className="flex items-center gap-2">
                  <Select value={row.type} onChange={(e) => updAct(row.id, { type: e.target.value as ActionType, params: {} })} data-testid="rule-action-type">
                    {actionTypes.map((t) => (
                      <option key={t} value={t}>{ACTION_LABELS[t]}</option>
                    ))}
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => setActs((r) => r.filter((x) => x.id !== row.id))} title="Remove">
                    <Trash2 />
                  </Button>
                </div>
                <ActionParams row={row} options={options} onChange={(k, v) => updParam(row.id, k, v)} />
              </div>
            ))}
          </section>

          <Separator />

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={stopOnMatch} onCheckedChange={setStopOnMatch} />
              Stop evaluating further rules on match
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save} loading={busy === "save"} data-testid="rule-save">{src.id ? "Save changes" : "Create rule"}</Button>
          </div>
        </div>
  );
}

function ActionParams({ row, options, onChange }: { row: ActRow; options: RuleBuilderOptions; onChange: (key: string, value: string) => void }) {
  const p = row.params;
  switch (row.type) {
    case "CREATE_PROPOSAL":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Length">
            <Select value={p.length ?? ""} onChange={(e) => onChange("length", e.target.value)}>
              <option value="">Default</option>
              {options.lengths.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tone">
            <Select value={p.tone ?? ""} onChange={(e) => onChange("tone", e.target.value)}>
              <option value="">Default</option>
              {options.tones.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case "SET_LEAD_STATUS":
      return (
        <Field label="Status" hint="WON cannot be set by rules — requires human deal approval.">
          <Select value={p.status ?? LEAD_STATUSES[0]} onChange={(e) => onChange("status", e.target.value)}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
      );
    case "CREATE_TASK":
    case "REQUEST_HUMAN_APPROVAL":
      return (
        <Field label="Task title">
          <Input value={p.title ?? ""} onChange={(e) => onChange("title", e.target.value)} placeholder={row.type === "CREATE_TASK" ? "Follow up" : "Human approval required"} />
        </Field>
      );
    case "EXCLUDE_JOB":
      return (
        <Field label="Reason">
          <Input value={p.reason ?? ""} onChange={(e) => onChange("reason", e.target.value)} placeholder="automation_rule" />
        </Field>
      );
    case "NOTIFY":
      return (
        <Field label="Message">
          <Input value={p.message ?? ""} onChange={(e) => onChange("message", e.target.value)} placeholder="Automation notification" />
        </Field>
      );
    case "GENERATE_REPLY":
      return (
        <Field label="Instruction (optional)">
          <Input value={p.instruction ?? ""} onChange={(e) => onChange("instruction", e.target.value)} placeholder="e.g. keep it short and propose a call" />
        </Field>
      );
    default:
      return <p className="text-[11px] text-muted-foreground">No parameters.</p>;
  }
}

/** Header button that opens an empty builder. */
export function NewRuleButton({ options, disabled, hint }: { options: RuleBuilderOptions; disabled?: boolean; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled} title={hint} data-testid="rule-new">
        <Workflow /> New rule
      </Button>
      <RuleBuilderDialog open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}

/** Per-row: enabled toggle, edit (prefilled builder) and delete (with confirm). */
export function RuleRowActions({ rule, options }: { rule: RuleFormData & { id: string }; options: RuleBuilderOptions }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setEnabled(next);
    try {
      await api(`/api/automation/rules/${rule.id}`, { method: "PATCH", json: { enabled: next } });
      toast.success(next ? "Rule enabled" : "Rule disabled");
      router.refresh();
    } catch (e) {
      setEnabled(!next);
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/automation/rules/${rule.id}`, { method: "DELETE" });
      toast.success("Rule deleted");
      setConfirm(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch checked={enabled} onCheckedChange={toggle} aria-label="Enabled" data-testid="rule-toggle" />
      <Button variant="ghost" size="xs" onClick={() => setEdit(true)} data-testid="rule-edit">Edit</Button>
      <Button variant="ghost" size="xs" className="text-danger" onClick={() => setConfirm(true)} data-testid="rule-delete">Delete</Button>
      <RuleBuilderDialog open={edit} onOpenChange={setEdit} initial={rule} options={options} />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Delete rule" description={`"${rule.name}" and its run history will be removed.`}>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={remove} loading={busy} data-testid="rule-delete-confirm">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
