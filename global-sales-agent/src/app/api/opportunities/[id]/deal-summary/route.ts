import { withAuth, ok } from "@/lib/api";
import { createDealSummary } from "@/lib/services/deals";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("deal:read", async (_req, { user, params }) => {
  const { id } = await params;
  return ok(await createDealSummary(user.orgId, id, user.id));
});
