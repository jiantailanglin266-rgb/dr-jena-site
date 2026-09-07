import { withAuth, ok } from "@/lib/api";
import { listOpportunities } from "@/lib/services/crm";

export const GET = withAuth("crm:read", async (_req, { user }) => ok(await listOpportunities(user.orgId)));
