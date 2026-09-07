import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { updateTask } from "@/lib/services/crm";

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>("crm:write", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ status: z.enum(["OPEN", "DONE", "CANCELLED"]).optional(), assigneeUserId: z.string().nullable().optional() }));
  return ok(await updateTask(user.orgId, id, b));
});
