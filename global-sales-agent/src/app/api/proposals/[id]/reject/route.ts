import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { rejectProposal } from "@/lib/services/proposals";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("proposal:approve", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ reason: z.string().min(1).default("rejected") })).catch(() => ({ reason: "rejected" }));
  await rejectProposal(user.orgId, id, user.id, b.reason);
  return ok({ id, status: "CLOSED" });
});
