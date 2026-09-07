import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { upsertPlatformLimit } from "@/lib/services/platforms";

export const PUT = withAuth<{ params: Promise<{ key: string }> }>("org:settings", async (req, { user, params }) => {
  const { key } = await params;
  const b = await parseBody(req, z.object({ dailyLimit: z.number().int().min(0), hourlyLimit: z.number().int().min(0), maxContactsPerClientPerWeek: z.number().int().min(0) }));
  return ok(await upsertPlatformLimit(user.orgId, user.id, { platformKey: key, ...b }));
});
