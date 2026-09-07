import { z } from "zod";
import { withAuth, ok, parseQuery } from "@/lib/api";
import { listJobs } from "@/lib/services/jobs";

const q = z.object({
  status: z.enum(["NEW", "ANALYZED", "QUALIFIED", "EXCLUDED", "ARCHIVED"]).optional(),
  platformKey: z.string().optional(), category: z.string().optional(), country: z.string().optional(), q: z.string().optional(),
  minScore: z.coerce.number().optional(), page: z.coerce.number().optional(), pageSize: z.coerce.number().optional(), sort: z.enum(["score", "posted", "budget"]).optional(),
});

export const GET = withAuth("job:read", async (req, { user }) => ok(await listJobs(user.orgId, parseQuery(req, q))));
