import { z } from "zod";
import { withAuth, ok, parseQuery } from "@/lib/api";
import { listCompanies } from "@/lib/services/crm";

export const GET = withAuth("crm:read", async (req, { user }) => {
  const q = parseQuery(req, z.object({ q: z.string().optional(), page: z.coerce.number().optional(), pageSize: z.coerce.number().optional() }));
  return ok(await listCompanies(user.orgId, q.q, q.page ?? 1, q.pageSize ?? 25));
});
