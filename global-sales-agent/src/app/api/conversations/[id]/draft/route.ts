import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { draftReply } from "@/lib/services/conversations";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("conversation:reply", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ instruction: z.string().optional() })).catch(() => ({ instruction: undefined }));
  return ok(await draftReply(user.orgId, id, { instruction: b.instruction }, user.id));
});
