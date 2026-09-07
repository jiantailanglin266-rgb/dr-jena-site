import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { ActorType } from "@prisma/client";

const ACTOR_TYPES: ActorType[] = ["USER", "AI", "SYSTEM"];
const PAGE_SIZE = 50;

type Search = { actorType?: string; entityType?: string; entityId?: string; page?: string };

function pretty(v: unknown) {
  if (v === null || v === undefined) return null;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const actorType = ACTOR_TYPES.includes(sp.actorType as ActorType) ? (sp.actorType as ActorType) : undefined;
  const entityType = sp.entityType?.trim() || undefined;
  const entityId = sp.entityId?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = { organizationId: user.orgId, ...(actorType ? { actorType } : {}), ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}) };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (actorType) u.set("actorType", actorType);
    if (entityType) u.set("entityType", entityType);
    if (entityId) u.set("entityId", entityId);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/audit${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Audit log" description="Every human, AI and system action with before/after snapshots." />

      <Card className="mb-4">
        <CardContent className="p-4">
          <form method="get" action="/audit" className="flex flex-wrap items-end gap-3" data-testid="audit-filters">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="actorType">Actor</Label>
              <Select id="actorType" name="actorType" defaultValue={actorType ?? ""} className="w-36" data-testid="audit-actor-type">
                <option value="">All</option>
                {ACTOR_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entityType">Entity type</Label>
              <Input id="entityType" name="entityType" defaultValue={entityType ?? ""} placeholder="proposal, job, deal…" className="w-44" data-testid="audit-entity-type" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entityId">Entity ID</Label>
              <Input id="entityId" name="entityId" defaultValue={entityId ?? ""} placeholder="id" className="w-56 font-mono" data-testid="audit-entity-id" />
            </div>
            <Button type="submit" size="sm" variant="outline" data-testid="audit-apply">Apply</Button>
            {actorType || entityType || entityId ? (
              <Button asChild size="sm" variant="ghost">
                <Link href="/audit">Clear</Link>
              </Button>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">{total} entries</span>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table data-testid="audit-table">
            <THead>
              <TR>
                <TH className="pl-5">Time</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Reason</TH>
                <TH className="pr-5">Details</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No audit entries match these filters.</TD>
                </TR>
              ) : null}
              {items.map((a) => {
                const before = pretty(a.before);
                const after = pretty(a.after);
                const actorLabel = a.actorType === "USER" ? a.user?.name ?? a.actorId ?? "user" : a.actorType === "AI" ? a.agent ?? a.actorId ?? "agent" : "system";
                return (
                  <TR key={a.id} data-testid="audit-row" className="align-top">
                    <TD className="whitespace-nowrap pl-5 text-xs text-muted-foreground" title={a.createdAt.toISOString()}>{formatDateTime(a.createdAt)}</TD>
                    <TD>
                      <span className="flex items-center gap-2">
                        <Badge variant={a.actorType === "AI" ? "accent" : a.actorType === "USER" ? "info" : "secondary"}>{a.actorType}</Badge>
                        <span className="text-xs">{actorLabel}</span>
                      </span>
                    </TD>
                    <TD className="text-xs font-medium">{a.action}</TD>
                    <TD className="text-xs">
                      <span className="text-muted-foreground">{a.entityType}</span>
                      {a.entityId ? (
                        <>
                          {" · "}
                          <Link href={`/audit?entityType=${encodeURIComponent(a.entityType)}&entityId=${encodeURIComponent(a.entityId)}`} className="font-mono underline-offset-2 hover:underline">
                            {a.entityId.slice(0, 12)}
                          </Link>
                        </>
                      ) : null}
                    </TD>
                    <TD className="max-w-[240px] text-xs text-muted-foreground">{a.reason ?? "—"}</TD>
                    <TD className="pr-5">
                      {before || after ? (
                        <details className="group text-xs">
                          <summary className="cursor-pointer select-none text-accent underline-offset-2 hover:underline">before / after</summary>
                          <div className="mt-2 grid max-w-[560px] gap-2 md:grid-cols-2">
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Before</p>
                              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed">{before ?? "—"}</pre>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">After</p>
                              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed">{after ?? "—"}</pre>
                            </div>
                          </div>
                        </details>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="xs">
            <Link href={qs(Math.max(1, page - 1))} aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>Previous</Link>
          </Button>
          <Button asChild variant="outline" size="xs">
            <Link href={qs(Math.min(pages, page + 1))} aria-disabled={page >= pages} className={page >= pages ? "pointer-events-none opacity-50" : undefined}>Next</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
