import { withAuth, ok } from "@/lib/api";
import { approveProposal } from "@/lib/services/proposals";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("proposal:approve", async (_req, { user, params }) => {
  const { id } = await params;
  return ok(await approveProposal(user.orgId, id, user.id));
});
