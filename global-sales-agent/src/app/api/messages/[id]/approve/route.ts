import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { sendMessage } from "@/lib/services/conversations";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("conversation:approve", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ body: z.string().optional() })).catch(() => ({ body: undefined }));
  return ok(await sendMessage(user.orgId, id, user.id, { body: b.body }));
});
