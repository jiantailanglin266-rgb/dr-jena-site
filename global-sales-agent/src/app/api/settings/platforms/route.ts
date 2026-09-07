import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { listPlatformAccounts, upsertPlatformAccount } from "@/lib/services/platforms";

export const GET = withAuth("org:read", async (_req, { user }) => ok(await listPlatformAccounts(user.orgId)));
export const PATCH = withAuth("platform:manage", async (req, { user }) => {
  const b = await parseBody(req, z.object({ platformKey: z.string(), label: z.string().optional(), enabled: z.boolean().optional(), sendMode: z.enum(["AUTO", "MANUAL_APPROVAL", "MANUAL_ONLY"]).optional(), credentials: z.record(z.string(), z.string()).optional(), config: z.record(z.string(), z.unknown()).optional() }));
  return ok(await upsertPlatformAccount(user.orgId, user.id, b));
});
