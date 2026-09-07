import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { listCompanies } from "@/lib/services/crm";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { PageHeader, EmptyState, Flag } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dec, formatCurrency } from "@/lib/utils";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, pageSize } = await listCompanies(user.orgId, q, page, 50);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        title="Companies"
        description="Clients synced from won deals and discovered opportunities."
        actions={
          <form className="flex items-center gap-2" action="/crm/companies" method="get">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={q ?? ""} placeholder="Search companies…" className="h-8 w-56 pl-8 text-xs" data-testid="companies-search" />
            </div>
            <Button size="sm" variant="outline" type="submit">Search</Button>
          </form>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={<Building2 />} title={q ? `No companies match “${q}”` : "No companies yet"} description="Companies are created automatically when a deal is approved as WON." action={q ? <Button variant="outline" size="sm" asChild><Link href="/crm/companies">Clear search</Link></Button> : undefined} />
      ) : (
        <Card>
          <Table data-testid="companies-table">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Platform</TH>
                <TH>Country</TH>
                <TH>Language</TH>
                <TH className="text-right">Rating</TH>
                <TH className="text-right">Opportunities</TH>
                <TH className="text-right">Contacts</TH>
                <TH className="text-right">Total won (USD)</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id} data-testid="company-row">
                  <TD>
                    <Link href={`/crm/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    {c.industry ? <p className="text-[11px] text-muted-foreground">{c.industry}</p> : null}
                  </TD>
                  <TD>{c.platformKey ? <Badge variant="outline" className="font-normal">{c.platformKey}</Badge> : <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    <span className="flex items-center gap-1.5"><Flag country={c.country} /> {c.country ?? ""}</span>
                  </TD>
                  <TD className="text-xs">{c.language ? LANGUAGE_NAMES[c.language] ?? c.language : "—"}</TD>
                  <TD className="text-right tabular-nums">{c.rating !== null ? dec(c.rating).toFixed(1) : "—"}</TD>
                  <TD className="text-right tabular-nums">{c._count.opportunities}</TD>
                  <TD className="text-right tabular-nums">{c._count.contacts}</TD>
                  <TD className="text-right font-medium tabular-nums">{formatCurrency(dec(c.totalWonValueUsd), "USD")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} compan{total === 1 ? "y" : "ies"}</span>
        {pages > 1 ? (
          <span className="flex items-center gap-2">
            {page > 1 ? <Link href={`/crm/companies?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">Prev</Link> : null}
            Page {page} / {pages}
            {page < pages ? <Link href={`/crm/companies?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">Next</Link> : null}
          </span>
        ) : null}
      </div>
    </>
  );
}
