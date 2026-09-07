import { withAuth, ok } from "@/lib/api";
import { testPlatformConnection } from "@/lib/services/platforms";

export const POST = withAuth<{ params: Promise<{ key: string }> }>("platform:manage", async (_req, { user, params }) => {
  const { key } = await params;
  return ok(await testPlatformConnection(user.orgId, key));
});
