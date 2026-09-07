import { z } from "zod";
import { withAuth, ok, parseBody } from "@/lib/api";
import { createProposal } from "@/lib/services/proposals";

const body = z.object({
  length: z.enum(["SHORT", "STANDARD", "DETAILED"]).optional(),
  tone: z.enum(["PROFESSIONAL", "FRIENDLY", "CONSULTATIVE", "EXECUTIVE", "TECHNICAL", "PREMIUM"]).optional(),
  language: z.string().optional(), variantLabel: z.string().optional(), regenerate: z.boolean().optional(), changeReason: z.string().optional(),
}).default({});

export const POST = withAuth<{ params: Promise<{ id: string }> }>("proposal:create", async (req, { user, params }) => {
  const { id } = await params;
  const b = await parseBody(req, body).catch(() => ({}) as z.infer<typeof body>);
  return ok(await createProposal(user.orgId, id, b, user.id));
});
