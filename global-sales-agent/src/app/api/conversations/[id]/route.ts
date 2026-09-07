import { withAuth, ok } from "@/lib/api";
import { buildThreadContext } from "@/lib/agents/thread";

export const GET = withAuth<{ params: Promise<{ id: string }> }>("conversation:read", async (_req, { user, params }) => {
  const { id } = await params;
  return ok(await buildThreadContext(user.orgId, id));
});
