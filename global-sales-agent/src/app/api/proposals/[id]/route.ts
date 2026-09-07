import { z } from "zod";
import { withAuth, ok, fail, parseBody } from "@/lib/api";
import { getProposal, editProposal } from "@/lib/services/proposals";

type Ctx = { params: Promise<{ id: string }> };
export const GET = withAuth<Ctx>("proposal:read", async (_req, { user, params }) => {
  const { id } = await params;
  const p = await getProposal(user.orgId, id);
  return p ? ok(p) : fail("Not found", 404);
});
export const PATCH = withAuth<Ctx>("proposal:edit", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ proposalTranslated: z.string().min(20), proposalOriginal: z.string().optional(), changeReason: z.string().optional() }));
  return ok(await editProposal(user.orgId, id, user.id, b));
});
