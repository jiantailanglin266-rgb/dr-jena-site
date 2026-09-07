import { withAuth, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/ai/provider";
import { logAudit } from "@/lib/audit";

/** DEMO ONLY: reset the organisation's pipeline data (keeps jobs, profile, settings, rules). Requires DEMO_MODE=true. */
export const POST = withAuth("org:settings", async (_req, { user }) => {
  if (!isDemoMode()) return fail("Only available in DEMO_MODE", 403);
  const orgId = user.orgId;
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { organizationId: orgId } }),
    prisma.quote.deleteMany({ where: { organizationId: orgId } }),
    prisma.deal.deleteMany({ where: { organizationId: orgId } }),
    prisma.conversation.deleteMany({ where: { organizationId: orgId } }),
    prisma.proposalVersion.deleteMany({ where: { organizationId: orgId } }),
    prisma.proposal.deleteMany({ where: { organizationId: orgId } }),
    prisma.performanceMemory.deleteMany({ where: { organizationId: orgId } }),
    prisma.task.deleteMany({ where: { organizationId: orgId } }),
    prisma.activity.deleteMany({ where: { organizationId: orgId } }),
    prisma.automationRun.deleteMany({ where: { organizationId: orgId } }),
    prisma.jobAnalysis.deleteMany({ where: { organizationId: orgId } }),
    prisma.opportunity.updateMany({ where: { organizationId: orgId }, data: { status: "DISCOVERED", lostReason: null, stageChangedAt: new Date() } }),
    prisma.job.updateMany({ where: { organizationId: orgId }, data: { status: "NEW", excludedReason: null } }),
    prisma.client.updateMany({ where: { organizationId: orgId }, data: { totalWonValueUsd: 0 } }),
  ]);
  await logAudit({ orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "demo.reset", entityType: "organization", entityId: orgId });
  return ok({ reset: true });
});
