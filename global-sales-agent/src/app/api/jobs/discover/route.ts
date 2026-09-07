import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { runDiscovery } from "@/lib/services/discovery";
import { logAudit } from "@/lib/audit";

const body = z.object({ platformKey: z.string().optional(), limit: z.number().int().min(1).max(1000).optional(), analyze: z.boolean().optional() }).default({});

export const POST = withAuth("job:discover", async (req, { user }) => {
  const b = await parseBody(req, body).catch(() => ({}) as z.infer<typeof body>);
  await logAudit({ orgId: user.orgId, actorType: "USER", userId: user.id, actorId: user.id, action: "discovery.requested", entityType: "organization", entityId: user.orgId, after: b });
  return ok(await runDiscovery(user.orgId, b));
});
