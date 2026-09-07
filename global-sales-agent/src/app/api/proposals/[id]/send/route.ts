import { withAuth, ok } from "@/lib/api";
import { sendProposal } from "@/lib/sending/send-engine";
import { prisma } from "@/lib/db";

/** Retry sending an APPROVED / SCHEDULED / FAILED proposal */
export const POST = withAuth<{ params: Promise<{ id: string }> }>("proposal:send", async (_req, { user, params }) => {
  const { id } = await params;
  const p = await prisma.proposal.findFirstOrThrow({ where: { id, organizationId: user.orgId } });
  if (p.status === "FAILED" || p.status === "SCHEDULED") await prisma.proposal.update({ where: { id }, data: { status: "APPROVED" } });
  return ok(await sendProposal(user.orgId, id, user.id));
});
