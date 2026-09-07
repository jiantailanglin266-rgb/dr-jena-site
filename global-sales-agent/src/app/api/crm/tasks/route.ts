import { z } from "zod";
import { withAuth, ok, parseQuery } from "@/lib/api";
import { listTasks } from "@/lib/services/crm";

export const GET = withAuth("crm:read", async (req, { user }) => {
  const q = parseQuery(req, z.object({ status: z.enum(["OPEN", "DONE", "CANCELLED"]).optional() }));
  return ok(await listTasks(user.orgId, q.status ?? "OPEN"));
});
