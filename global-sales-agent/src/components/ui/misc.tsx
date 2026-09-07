import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, trend, icon }: { label: string; value: React.ReactNode; hint?: string; trend?: number | null; icon?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint || trend !== undefined ? (
        <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          {trend !== undefined && trend !== null ? <span className={cn("font-medium", trend >= 0 ? "text-success" : "text-danger")}>{trend >= 0 ? "+" : ""}{trend.toFixed(1)}%</span> : null}
          {hint}
        </p>
      ) : null}
    </Card>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-muted-foreground [&_svg]:size-8">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ScoreRing({ score, size = 44, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--success)" : score >= 60 ? "var(--accent)" : score >= 40 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight={600} fill="currentColor">{score}</text>
      </svg>
      {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
    </div>
  );
}

export function ScoreBar({ label, value, className }: { label: string; value: number; className?: string }) {
  const color = value >= 80 ? "bg-success" : value >= 60 ? "bg-accent" : value >= 40 ? "bg-warning" : "bg-danger";
  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v ?? "—"}</span>
    </div>
  );
}

export function Flag({ country }: { country: string | null | undefined }) {
  if (!country || country.length !== 2) return <span className="text-muted-foreground">—</span>;
  const cps = country.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0));
  return <span title={country}>{String.fromCodePoint(...cps)}</span>;
}
