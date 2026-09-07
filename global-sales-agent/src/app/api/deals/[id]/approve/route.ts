import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { approveDeal } from "@/lib/services/deals";

const body = z.object({ checklist: z.array(z.object({ key: z.string(), confirmed: z.boolean(), value: z.string().nullable().optional() })).optional(), amount: z.number().positive().optional(), notes: z.string().optional() }).default({});

export const POST = withAuth<{ params: Promise<{ id: string }> }>("deal:approve", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, body).catch(() => ({}) as z.infer<typeof body>);
  return ok(await approveDeal(user.orgId, id, user.id, b));
});
