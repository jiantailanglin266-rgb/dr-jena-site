import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { pollReplies } from "@/lib/services/conversations";

export const POST = withAuth("conversation:read", async (req, { user }) => {
  const b = await parseBody(req, z.object({ platformKey: z.string().optional() })).catch(() => ({ platformKey: undefined }));
  return ok(await pollReplies(user.orgId, b.platformKey));
});
