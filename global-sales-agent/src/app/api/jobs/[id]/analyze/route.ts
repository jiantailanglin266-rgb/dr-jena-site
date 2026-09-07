import { withAuth, ok } from "@/lib/api";
import { analyzeJob } from "@/lib/services/jobs";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("job:analyze", async (_req, { user, params }) => {
  const { id } = await params;
  return ok(await analyzeJob(user.orgId, id));
});
