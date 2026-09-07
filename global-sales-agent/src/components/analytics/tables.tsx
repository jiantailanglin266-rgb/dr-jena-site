import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Flag } from "@/components/ui/misc";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { BreakdownRow } from "@/lib/services/analytics";

/** Jobs / proposals / replies / won / rates / revenue by one dimension. Server-safe (no hooks). */
export function BreakdownTable({ rows, dim, labelFor }: { rows: BreakdownRow[]; dim: string; labelFor?: (key: string) => string }) {
  return (
    <Table data-testid={`analytics-breakdown-${dim}`}>
      <THead>
        <TR>
          <TH>{dim}</TH>
          <TH className="text-right">Jobs</TH>
          <TH className="text-right">Proposals</TH>
          <TH className="text-right">Replies</TH>
          <TH className="text-right">Won</TH>
          <TH className="text-right">Reply rate</TH>
          <TH className="text-right">Win rate</TH>
          <TH className="text-right">Revenue</TH>
        </TR>
      </THead>
      <TBody>
        {rows.length === 0 ? (
          <TR>
            <TD colSpan={8} className="py-6 text-center text-xs text-muted-foreground">No data yet</TD>
          </TR>
        ) : null}
        {rows.map((r) => (
          <TR key={r.key} data-testid="analytics-breakdown-row">
            <TD className="font-medium">
              <span className="flex items-center gap-2">
                {dim === "country" ? <Flag country={r.key} /> : null}
                {labelFor ? labelFor(r.key) : r.key}
              </span>
            </TD>
            <TD className="text-right tabular-nums">{r.jobs}</TD>
            <TD className="text-right tabular-nums">{r.proposals}</TD>
            <TD className="text-right tabular-nums">{r.replies}</TD>
            <TD className="text-right tabular-nums">{r.won}</TD>
            <TD className="text-right tabular-nums">{formatPct(r.replyRate, 0)}</TD>
            <TD className="text-right tabular-nums">{formatPct(r.winRate, 0)}</TD>
            <TD className="text-right tabular-nums">{formatCurrency(r.revenueUsd, "USD")}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export interface AbRow { value: string; n: number; replyRate: number; winRate: number }

/** Compact n / reply rate / win rate table for one A/B dimension. */
export function AbTable({ title, rows, testId }: { title: string; rows: AbRow[]; testId?: string }) {
  return (
    <div className="rounded-lg border border-border" data-testid={testId}>
      <p className="border-b border-border px-3 py-2 text-xs font-semibold">{title}</p>
      <Table>
        <THead>
          <TR>
            <TH>Value</TH>
            <TH className="text-right">n</TH>
            <TH className="text-right">Reply</TH>
            <TH className="text-right">Win</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TR>
              <TD colSpan={4} className="py-4 text-center text-xs text-muted-foreground">No data</TD>
            </TR>
          ) : null}
          {rows.map((r) => (
            <TR key={r.value}>
              <TD className="text-xs font-medium">{r.value}</TD>
              <TD className="text-right text-xs tabular-nums">{r.n}</TD>
              <TD className="text-right text-xs tabular-nums">{formatPct(r.replyRate, 0)}</TD>
              <TD className="text-right text-xs tabular-nums">{formatPct(r.winRate, 0)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
