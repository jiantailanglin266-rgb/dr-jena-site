"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { api } from "@/lib/client-api";

export interface CompanyFormValues {
  name: string;
  website: string;
  industry: string;
  country: string;
  language: string;
  notes: string;
}

export function CompanyForm({ id, initial, languages }: { id: string; initial: CompanyFormValues; languages: { code: string; label: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CompanyFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const nul = (s: string) => (s.trim() ? s.trim() : null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      await api(`/api/crm/companies/${id}`, { method: "PATCH", json: { name: v.name.trim(), website: nul(v.website), industry: nul(v.industry), country: nul(v.country)?.toUpperCase() ?? null, language: nul(v.language), notes: nul(v.notes) } });
      toast.success("Company saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" data-testid="company-form">
      <Field label="Name" className="sm:col-span-2">
        <Input value={v.name} onChange={set("name")} required data-testid="company-name" />
      </Field>
      <Field label="Website">
        <Input value={v.website} onChange={set("website")} placeholder="https://" />
      </Field>
      <Field label="Industry">
        <Input value={v.industry} onChange={set("industry")} placeholder="e.g. E-commerce" />
      </Field>
      <Field label="Country" hint="ISO-3166 alpha-2, e.g. US, DE, JP">
        <Input value={v.country} onChange={set("country")} maxLength={2} className="uppercase" />
      </Field>
      <Field label="Language">
        <Select value={v.language} onChange={set("language")}>
          <option value="">—</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea value={v.notes} onChange={set("notes")} rows={4} placeholder="Internal notes about this client…" />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" size="sm" loading={busy} data-testid="company-save">
          <Save /> Save changes
        </Button>
      </div>
    </form>
  );
}

export function AddContactDialog({ clientId, languages }: { clientId: string; languages: { code: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = { name: "", email: "", role: "", language: "", timezone: "", notes: "" };
  const [v, setV] = useState(empty);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const nul = (s: string) => (s.trim() ? s.trim() : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      await api("/api/crm/contacts", { method: "POST", json: { clientId, name: v.name.trim(), email: nul(v.email), role: nul(v.role), language: nul(v.language), timezone: nul(v.timezone), notes: nul(v.notes) } });
      toast.success("Contact added");
      setV(empty);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="contact-add">
          <UserPlus /> Add contact
        </Button>
      </DialogTrigger>
      <DialogContent title="Add contact" description="A person at this company you communicate with.">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" data-testid="contact-form">
          <Field label="Name" className="sm:col-span-2">
            <Input value={v.name} onChange={set("name")} required autoFocus data-testid="contact-name" />
          </Field>
          <Field label="Email">
            <Input type="email" value={v.email} onChange={set("email")} data-testid="contact-email" />
          </Field>
          <Field label="Role">
            <Input value={v.role} onChange={set("role")} placeholder="e.g. Product Manager" />
          </Field>
          <Field label="Language">
            <Select value={v.language} onChange={set("language")}>
              <option value="">—</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Timezone">
            <Input value={v.timezone} onChange={set("timezone")} placeholder="e.g. America/New_York" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={v.notes} onChange={set("notes")} rows={3} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button type="submit" size="sm" loading={busy} data-testid="contact-save">Add contact</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
