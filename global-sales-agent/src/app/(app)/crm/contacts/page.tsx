import Link from "next/link";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { listContacts } from "@/lib/services/crm";
import { LANGUAGE_NAMES } from "@/lib/settings";
import { PageHeader, EmptyState, Flag } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";

export default async function ContactsPage() {
  const user = await requireSession();
  const contacts = await listContacts(user.orgId);
  return (
    <>
      <PageHeader title="Contacts" description="People at client companies. Add contacts from a company page." />
      {contacts.length === 0 ? (
        <EmptyState icon={<Users />} title="No contacts yet" description="A primary contact is created automatically when a deal is won." />
      ) : (
        <Card>
          <Table data-testid="contacts-table">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Company</TH>
                <TH>Role</TH>
                <TH>Email</TH>
                <TH>Language</TH>
                <TH>Timezone</TH>
                <TH className="text-right">Updated</TH>
              </TR>
            </THead>
            <TBody>
              {contacts.map((c) => (
                <TR key={c.id} data-testid="contact-row">
                  <TD className="font-medium">{c.name}</TD>
                  <TD>
                    <Link href={`/crm/companies/${c.client.id}`} className="flex items-center gap-1.5 hover:underline">
                      <Flag country={c.client.country} /> {c.client.name}
                    </Link>
                  </TD>
                  <TD className="text-xs text-muted-foreground">{c.role ?? "—"}</TD>
                  <TD className="text-xs">{c.email ? <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a> : "—"}</TD>
                  <TD className="text-xs">{c.language ? LANGUAGE_NAMES[c.language] ?? c.language : "—"}</TD>
                  <TD className="text-xs text-muted-foreground">{c.timezone ?? "—"}</TD>
                  <TD className="text-right text-xs text-muted-foreground">{timeAgo(c.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
