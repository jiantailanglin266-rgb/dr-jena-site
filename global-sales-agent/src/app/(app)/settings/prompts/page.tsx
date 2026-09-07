import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AGENT_NAMES, DEFAULT_PROMPTS, type AgentName } from "@/lib/agents/prompts";
import { PromptEditor, type PromptEditorData } from "@/components/settings/prompt-editor";

const DESCRIPTIONS: Record<AgentName, string> = {
  scout: "Chooses keywords and categories for job discovery.",
  analyst: "Scores every job (fit, profit, risk, win probability) against your profile.",
  proposal: "Writes the individualised 10-section proposal in the client's language.",
  translation: "Translates proposals and replies between languages faithfully.",
  compliance: "Reviews outbound text for unverifiable claims and marketplace rule violations.",
  reply: "Classifies inbound replies and drafts grounded responses using the full thread.",
  negotiation: "Chooses an allowed pricing strategy and writes the negotiation message.",
  closing: "Produces the Deal Summary that a person approves before WON.",
  supervisor: "Decides the next pipeline step according to automation settings.",
};

export default async function PromptsSettingsPage() {
  const user = await requireSession();
  const custom = await prisma.promptTemplate.findMany({ where: { organizationId: user.orgId } });
  const items: PromptEditorData[] = AGENT_NAMES.map((agent) => {
    const c = custom.find((x) => x.agent === agent);
    return { agent, description: DESCRIPTIONS[agent], defaults: DEFAULT_PROMPTS[agent], custom: c ? { system: c.system, user: c.user, enabled: c.enabled } : null };
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Customise the system and user prompts per agent. Agents without a custom prompt use the built-in default. Placeholders in double braces are filled at run time.</p>
      {items.map((d, i) => (
        <PromptEditor key={d.agent} data={d} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
