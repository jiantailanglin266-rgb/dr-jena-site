import { withAuth, ok } from "@/lib/api";
import { draftNegotiationReply } from "@/lib/services/conversations";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("quote:create", async (_req, { user, params }) => {
  const { id } = await params;
  return ok(await draftNegotiationReply(user.orgId, id, user.id));
});
