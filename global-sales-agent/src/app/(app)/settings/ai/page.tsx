import { requireSession } from "@/lib/auth";
import { getOrgSettings, PROPOSAL_TONES, PROPOSAL_LENGTHS, AUTOMATION_LEVELS } from "@/lib/settings";
import { PLAN_LIMITS } from "@/lib/plans";
import { AiForm } from "@/components/settings/ai-form";

export default async function AiSettingsPage() {
  const user = await requireSession();
  const org = await getOrgSettings(user.orgId);
  const providers = { anthropic: Boolean(process.env.ANTHROPIC_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY), demo: process.env.DEMO_MODE === "true" };
  return <AiForm providers={providers} planLimits={PLAN_LIMITS[org.plan]} tones={PROPOSAL_TONES} lengths={PROPOSAL_LENGTHS} levels={AUTOMATION_LEVELS} settings={org.settings} />;
}
