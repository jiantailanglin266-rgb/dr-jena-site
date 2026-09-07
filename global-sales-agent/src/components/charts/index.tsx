"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const CHART_COLORS = { primary: "var(--accent)", secondary: "#a1a1aa", success: "var(--success)", warning: "var(--warning)", muted: "var(--border)" };
const SERIES = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6", "#22c55e", "#0ea5e9", "#f97316"];

const tooltipStyle = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }, labelStyle: { color: "var(--muted-foreground)" }, cursor: { fill: "var(--muted)" } } as const;

export function TrendChart({ data, series, height = 220 }: { data: object[]; series: { key: string; label: string; color?: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? SERIES[i]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color ?? SERIES[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? SERIES[i]} strokeWidth={2} fill={`url(#g-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ stages }: { stages: { key: string; label: string; count: number; conversionFromPrev: number | null }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((s, i) => (
        <div key={s.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs">
          <span className="text-muted-foreground">{s.label}</span>
          <div className="h-6 overflow-hidden rounded-md bg-muted">
            <div className="flex h-full items-center rounded-md px-2 text-[11px] font-medium text-white transition-all" style={{ width: `${Math.max(4, (s.count / max) * 100)}%`, background: SERIES[i % SERIES.length] }}>
              {s.count}
            </div>
          </div>
          <span className="w-14 text-right tabular-nums text-muted-foreground">{s.conversionFromPrev === null ? "" : `${s.conversionFromPrev.toFixed(0)}%`}</span>
        </div>
      ))}
    </div>
  );
}

export function BarBreakdown({ data, xKey, valueKey, height = 200, color }: { data: object[]; xKey: string; valueKey: string; height?: number; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={valueKey} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color ?? SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
