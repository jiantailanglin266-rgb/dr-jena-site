import { z } from "zod";
import { withAuth, ok, parseBody, ApiError } from "@/lib/api";
import { importJobs } from "@/lib/services/jobs";
import { manualJobSchema, importRowToJob, parseCsv } from "@/lib/connectors/manual-import";

const body = z.object({ rows: z.array(manualJobSchema).optional(), csv: z.string().optional(), platform: z.string().optional(), analyze: z.boolean().default(true) });

export const POST = withAuth("job:discover", async (req, { user }) => {
  const b = await parseBody(req, body);
  let rows = b.rows ?? [];
  if (b.csv) rows = rows.concat(parseCsv(b.csv).map((r) => manualJobSchema.parse({ ...r, platform: b.platform ?? r.platform ?? "manual-import" })));
  if (!rows.length) throw new ApiError("No rows to import", 400);
  const jobs = rows.map((r) => importRowToJob({ ...r, platform: b.platform ?? r.platform }));
  return ok(await importJobs(user.orgId, jobs, user.id, b.analyze));
});
