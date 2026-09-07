import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { updateLeadStatus } from "@/lib/services/deals";

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>("crm:write", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ status: z.enum(["DISCOVERED", "QUALIFIED", "PROPOSAL_CREATED", "PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "FINAL_NEGOTIATION", "VERBAL_ACCEPT", "LOST"]) }));
  return ok(await updateLeadStatus(user.orgId, id, user.id, b.status));
});
