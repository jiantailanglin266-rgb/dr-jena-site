"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

export const ROLES = ["ADMIN", "MANAGER", "SALES", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export interface Member { id: string; userId: string; role: Role; createdAt: string; name: string; email: string }

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Full access incl. settings, team and platform credentials",
  MANAGER: "Approves proposals, replies and deals; manages CRM and automation",
  SALES: "Works jobs, proposals and conversations; needs approval where configured",
  VIEWER: "Read-only",
};

export function TeamTable({ members, currentUserId, canManage }: { members: Member[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  async function changeRole(m: Member, role: Role) {
    setBusy(m.id);
    try {
      await api(`/api/settings/team/${m.id}`, { method: "PATCH", json: { role } });
      toast.success(`${m.name} is now ${role}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(removing.id);
    try {
      await api(`/api/settings/team/${removing.id}`, { method: "DELETE" });
      toast.success(`${removing.name} removed`);
      setRemoving(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Table data-testid="team-table">
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Joined</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {members.map((m) => {
            const self = m.userId === currentUserId;
            return (
              <TR key={m.id} data-testid="team-row">
                <TD className="font-medium">
                  {m.name} {self ? <Badge variant="outline" className="ml-1">you</Badge> : null}
                </TD>
                <TD className="text-xs text-muted-foreground">{m.email}</TD>
                <TD>
                  <Select value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)} disabled={!canManage || self || busy === m.id} className="h-8 w-36 text-xs" title={ROLE_HELP[m.role]} data-testid="team-role">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>
                </TD>
                <TD className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</TD>
                <TD className="text-right">
                  <Button variant="ghost" size="xs" className="text-danger" disabled={!canManage || self} onClick={() => setRemoving(m)} data-testid="team-remove">Remove</Button>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <Dialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent title="Remove member" description={removing ? `${removing.name} (${removing.email}) will lose access to this organisation.` : undefined}>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={remove} loading={Boolean(removing && busy === removing.id)} data-testid="team-remove-confirm">Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddMemberButton({ disabled, hint }: { disabled?: boolean; hint?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "SALES" as Role });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      await api("/api/settings/team", { method: "POST", json: { name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password, role: f.role } });
      toast.success(`${f.name} added as ${f.role}`);
      setOpen(false);
      setF({ name: "", email: "", password: "", role: "SALES" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled} title={hint} data-testid="team-add">
        <UserPlus /> Add member
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add team member" description="Creates the user if the email is new, otherwise adds the existing user to this organisation.">
          <form onSubmit={submit} className="flex flex-col gap-4" data-testid="team-add-form">
            <Field label="Name">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus data-testid="team-add-name" />
            </Field>
            <Field label="Email">
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required data-testid="team-add-email" />
            </Field>
            <Field label="Password" hint="Minimum 8 characters">
              <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" data-testid="team-add-password" />
            </Field>
            <Field label="Role" hint={ROLE_HELP[f.role]}>
              <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} data-testid="team-add-role">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={busy} data-testid="team-add-submit">Add member</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
