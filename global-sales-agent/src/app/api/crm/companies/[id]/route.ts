import { z } from "zod";
import { withAuth, ok, fail, parseBody } from "@/lib/api";
import { getCompany, updateCompany } from "@/lib/services/crm";

type Ctx = { params: Promise<{ id: string }> };
export const GET = withAuth<Ctx>("crm:read", async (_req, { user, params }) => {
  const { id } = await params;
  const c = await getCompany(user.orgId, id);
  return c ? ok(c) : fail("Not found", 404);
});
export const PATCH = withAuth<Ctx>("crm:write", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ name: z.string().min(1).optional(), website: z.string().nullable().optional(), industry: z.string().nullable().optional(), notes: z.string().nullable().optional(), country: z.string().nullable().optional(), language: z.string().nullable().optional() }));
  return ok(await updateCompany(user.orgId, id, b));
});
