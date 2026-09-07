import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { composeMessage } from "@/lib/services/conversations";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("conversation:reply", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ body: z.string().min(1), send: z.boolean().default(true) }));
  return ok(await composeMessage(user.orgId, id, user.id, b.body, b.send));
});
