import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { rejectMessage } from "@/lib/services/conversations";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("conversation:approve", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ reason: z.string().optional() })).catch(() => ({ reason: undefined }));
  await rejectMessage(user.orgId, id, user.id, b.reason);
  return ok({ id, approvalStatus: "REJECTED" });
});
