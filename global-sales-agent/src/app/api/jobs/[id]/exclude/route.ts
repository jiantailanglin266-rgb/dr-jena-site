import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { excludeJob } from "@/lib/services/jobs";

export const POST = withAuth<{ params: Promise<{ id: string }> }>("job:analyze", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ reason: z.string().min(1).default("manual") }));
  await excludeJob(user.orgId, id, user.id, b.reason);
  return ok({ id, status: "EXCLUDED" });
});
