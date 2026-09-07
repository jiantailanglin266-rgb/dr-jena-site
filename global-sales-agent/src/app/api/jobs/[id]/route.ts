import { withAuth, ok, fail } from "@/lib/api";
import { getJob } from "@/lib/services/jobs";

export const GET = withAuth<{ params: Promise<{ id: string }> }>("job:read", async (_req, { user, params }) => {
  const { id } = await params;
  const job = await getJob(user.orgId, id);
  return job ? ok(job) : fail("Not found", 404);
});
