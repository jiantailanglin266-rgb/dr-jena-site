import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { markProposalSentManually } from "@/lib/services/proposals";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("proposal:send", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ externalProposalId: z.string().optional() })).catch(() => ({ externalProposalId: undefined }));
  return ok(await markProposalSentManually(user.orgId, id, user.id, b.externalProposalId));
});
