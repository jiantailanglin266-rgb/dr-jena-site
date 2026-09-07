import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { markLost } from "@/lib/services/deals";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("crm:write", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ reason: z.string().min(1).default("lost") })).catch(() => ({ reason: "lost" }));
  await markLost(user.orgId, id, user.id, b.reason);
  return ok({ id, status: "LOST" });
});
