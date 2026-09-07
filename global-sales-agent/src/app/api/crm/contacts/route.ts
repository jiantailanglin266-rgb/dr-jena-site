import { z } from "zod";
import { withAuth, ok, parseBody, parseQuery } from "@/lib/api";
import { listContacts, createContact } from "@/lib/services/crm";

export const GET = withAuth("crm:read", async (req, { user }) => {
  const q = parseQuery(req, z.object({ clientId: z.string().optional() }));
  return ok(await listContacts(user.orgId, q.clientId));
});
export const POST = withAuth("crm:write", async (req, { user }) => {
  const b = await parseBody(req, z.object({ clientId: z.string(), name: z.string().min(1), email: z.string().email().nullable().optional(), role: z.string().nullable().optional(), language: z.string().nullable().optional(), timezone: z.string().nullable().optional(), notes: z.string().nullable().optional() }));
  return ok(await createContact(user.orgId, b));
});
