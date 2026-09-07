import { withAuth, ok, fail } from "@/lib/api";
import { getDeal } from "@/lib/services/crm";

export const GET = withAuth<{ params: Promise<{ id: string }> }>("deal:read", async (_req, { user, params }) => {
  const { id } = await params;
  const d = await getDeal(user.orgId, id);
  return d ? ok(d) : fail("Not found", 404);
});
