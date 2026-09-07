import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getCompany } from "@/lib/services/crm";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { PageHeader, StatCard, Flag } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CompanyForm, AddContactDialog } from "@/components/crm/company-form";
import { dec, formatCurrency, timeAgo } from "@/lib/utils";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const company = await getCompany(user.orgId, id);
  if (!company) notFound();
  const languages = Object.entries(LANGUAGE_NAMES).map(([code, label]) => ({ code, label }));
  const wonDeals = company.deals.filter((d) => d.status === "WON").length;

  return (
    <>
      <PageHeader
        title={company.name}
        description={[company.industry, company.country, company.platformKey].filter(Boolean).join(" · ") || "Client"}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/crm/companies">
              <ArrowLeft /> Companies
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total won" value={formatCurrency(dec(company.totalWonValueUsd), "USD")} hint={`${wonDeals} won deal${wonDeals === 1 ? "" : "s"}`} />
        <StatCard label="Opportunities" value={company.opportunities.length} />
        <StatCard label="Contacts" value={company.contacts.length} />
        <StatCard label="Rating" value={company.rating !== null ? dec(company.rating).toFixed(1) : "—"} hint={company.paymentVerified ? "Payment verified" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>Edit profile information used in proposals and replies.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm id={company.id} languages={languages} initial={{ name: company.name, website: company.website ?? "", industry: company.industry ?? "", country: company.country ?? "", language: company.language ?? "", notes: company.notes ?? "" }} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>{company.contacts.length} contact{company.contacts.length === 1 ? "" : "s"}</CardDescription>
              </div>
              <AddContactDialog clientId={company.id} languages={languages} />
            </CardHeader>
            <CardContent>
              {company.contacts.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground">No contacts yet.</p>
              ) : (
                <Table data-testid="contacts-table">
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Role</TH>
                      <TH>Email</TH>
                      <TH>Lang</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {company.contacts.map((c) => (
                      <TR key={c.id} data-testid="contact-row">
                        <TD className="font-medium">{c.name}</TD>
                        <TD className="text-xs text-muted-foreground">{c.role ?? "—"}</TD>
                        <TD className="text-xs">{c.email ? <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a> : "—"}</TD>
                        <TD className="text-xs uppercase">{c.language ?? "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opportunities</CardTitle>
              <CardDescription>{company.opportunities.length} linked opportunit{company.opportunities.length === 1 ? "y" : "ies"}</CardDescription>
            </CardHeader>
            <CardContent>
              {company.opportunities.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground">No opportunities linked to this company.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {company.opportunities.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <Link href={`/jobs/${o.jobId}`} className="block truncate font-medium hover:underline">{o.title || o.job.projectTitle}</Link>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="font-normal">{o.job.platformKey}</Badge>
                          <span>{timeAgo(o.stageChangedAt)}</span>
                          {o.deal ? <Link href={`/crm/deals/${o.deal.id}`} className="text-accent hover:underline">deal →</Link> : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        <span className="tabular-nums text-muted-foreground">{o.estimatedValueUsd !== null ? formatCurrency(dec(o.estimatedValueUsd), "USD") : "—"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Flag country={company.country} /> {company.country ?? "—"} · {company.language ? LANGUAGE_NAMES[company.language] ?? company.language : "—"} · created {timeAgo(company.createdAt)}
      </p>
    </>
  );
}
