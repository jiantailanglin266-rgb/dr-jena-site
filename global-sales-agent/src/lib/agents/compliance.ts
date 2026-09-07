import { prisma } from "../db";
import { runJson } from "../ai/provider";
import { complianceSchema, type ComplianceOutput } from "./schemas";
import { getPrompt, renderPrompt } from "./prompts";
import type { AgentContext } from "./context";
import { getConnector } from "../connectors/registry";
import { checkSendLimits } from "../sending/limits";

export interface ComplianceInput {
  text: string;
  platformKey: string;
  jobId?: string;
  clientId?: string | null;
  /** skip limits check (e.g. when only reviewing text) */
  skipLimits?: boolean;
}

/**
 * Compliance Agent: rule-based checks (limits, duplicates, over-contact, platform policy, forbidden conditions)
 * + AI review of the text (unverifiable claims, guarantees).
 */
export async function runComplianceAgent(ctx: AgentContext, input: ComplianceInput): Promise<ComplianceOutput & { sendMode: "AUTO" | "MANUAL_APPROVAL" | "MANUAL_ONLY" }> {
  const issues: ComplianceOutput["issues"] = [];
  const connector = getConnector(input.platformKey);
  const account = await prisma.platformAccount.findUnique({ where: { organizationId_platformKey: { organizationId: ctx.orgId, platformKey: input.platformKey } } });
  const sendMode = account?.sendMode ?? connector.compliance.defaultSendMode;

  if (!account || !account.enabled) issues.push({ code: "PLATFORM_DISABLED", severity: "WARN", message: "Platform account is not enabled; proposal can only be sent manually." });
  if (connector.compliance.automatedSendingPolicy === "PROHIBITED" && sendMode === "AUTO") issues.push({ code: "AUTO_SEND_PROHIBITED", severity: "BLOCK", message: `${connector.displayName} prohibits automated sending; use MANUAL_ONLY.` });
  if (!connector.capabilities.sendProposal && sendMode === "AUTO") issues.push({ code: "NO_SEND_CAPABILITY", severity: "BLOCK", message: "Connector has no official send capability; switch to manual." });

  if (input.jobId) {
    const existing = await prisma.proposal.findUnique({ where: { jobId: input.jobId } });
    if (existing && existing.status === "SENT") issues.push({ code: "DUPLICATE_SEND", severity: "BLOCK", message: "A proposal was already sent for this job." });
  }
  if (!input.skipLimits) {
    const limits = await checkSendLimits(ctx.orgId, input.platformKey, input.clientId ?? null);
    for (const l of limits.violations) issues.push({ code: l.code, severity: "BLOCK", message: l.message });
  }
  const lower = input.text.toLowerCase();
  for (const f of ctx.profile.forbiddenConditions) {
    if (f && lower.includes(f.toLowerCase())) issues.push({ code: "FORBIDDEN_CONDITION", severity: "BLOCK", message: `Text mentions forbidden condition: ${f}` });
  }
  if (/\b(whatsapp|telegram|line id|my email|@gmail\.com|@yahoo\.)/i.test(input.text) && ["upwork", "freelancer", "coconala", "crowdworks", "lancers"].includes(input.platformKey)) {
    issues.push({ code: "OFF_PLATFORM_CONTACT", severity: "BLOCK", message: "Off-platform contact details are not allowed on this marketplace." });
  }

  const achievements = (ctx.profile.achievements as { title: string }[]).map((a) => a.title);
  const prompt = await getPrompt(ctx.orgId, "compliance");
  const { data } = await runJson(
    ctx.ai,
    complianceSchema,
    {
      agent: "compliance",
      purpose: "compliance_check",
      system: prompt.system,
      messages: [{ role: "user", content: renderPrompt(prompt.user, { achievements, platformNotes: connector.compliance.notes, text: input.text }) }],
      context: { text: input.text, achievements },
      maxTokens: 1500,
    },
    { entityType: input.jobId ? "job" : "text", entityId: input.jobId },
  );
  issues.push(...data.issues);
  const allowed = !issues.some((i) => i.severity === "BLOCK");
  return { allowed, issues, sendMode };
}
