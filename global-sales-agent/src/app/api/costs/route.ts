import { withAuth, ok } from "@/lib/api";
import { getAiCosts } from "@/lib/services/analytics";

export const GET = withAuth("costs:read", async (_req, { user }) => ok(await getAiCosts(user.orgId)));
