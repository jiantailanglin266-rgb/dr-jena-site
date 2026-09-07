import { withAuth, ok } from "@/lib/api";
import { listDeals } from "@/lib/services/crm";

export const GET = withAuth("deal:read", async (_req, { user }) => ok(await listDeals(user.orgId)));
