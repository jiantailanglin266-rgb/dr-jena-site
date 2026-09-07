import { z } from "zod";
import { withAuth, ok, parseQuery } from "@/lib/api";
import { listProposals } from "@/lib/services/proposals";

const q = z.object({ status: z.enum(["DRAFT", "AI_REVIEWED", "WAITING_APPROVAL", "APPROVED", "SCHEDULED", "SENT", "FAILED", "REPLIED", "CLOSED"]).optional(), platformKey: z.string().optional(), page: z.coerce.number().optional(), pageSize: z.coerce.number().optional() });

export const GET = withAuth("proposal:read", async (req, { user }) => ok(await listProposals(user.orgId, parseQuery(req, q))));
