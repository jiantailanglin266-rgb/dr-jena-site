import { z } from "zod";
import { withAuth, ok, parseQuery } from "@/lib/api";
import { listConversations } from "@/lib/services/conversations";

const q = z.object({ status: z.string().optional(), pending: z.string().optional(), page: z.coerce.number().optional(), pageSize: z.coerce.number().optional() });
export const GET = withAuth("conversation:read", async (req, { user }) => {
  const p = parseQuery(req, q);
  return ok(await listConversations(user.orgId, { status: p.status as never, pendingOnly: p.pending === "1", page: p.page, pageSize: p.pageSize }));
});
