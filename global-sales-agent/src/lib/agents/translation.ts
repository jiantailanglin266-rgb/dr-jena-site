import { runJson } from "../ai/provider";
import { translationSchema } from "./schemas";
import { getPrompt, renderPrompt } from "./prompts";
import type { AgentContext } from "./context";
import { detectLanguage } from "../language/detect";

/** Translation Agent — also used for Client Language Detection when needed. */
export async function runTranslationAgent(ctx: AgentContext, input: { text: string; targetLanguage: string; sourceLanguage?: string; entityType?: string; entityId?: string }): Promise<{ translated: string; sourceLanguage: string; targetLanguage: string }> {
  const sourceLanguage = input.sourceLanguage || detectLanguage(input.text);
  if (sourceLanguage === input.targetLanguage || !input.text.trim()) {
    return { translated: input.text, sourceLanguage, targetLanguage: input.targetLanguage };
  }
  const prompt = await getPrompt(ctx.orgId, "translation");
  const { data } = await runJson(
    ctx.ai,
    translationSchema,
    {
      agent: "translation",
      purpose: "translate",
      system: prompt.system,
      messages: [{ role: "user", content: renderPrompt(prompt.user, { sourceLanguage, targetLanguage: input.targetLanguage, text: input.text }) }],
      context: { text: input.text, targetLanguage: input.targetLanguage, sourceLanguage },
      maxTokens: 4000,
    },
    { entityType: input.entityType, entityId: input.entityId },
  );
  return { translated: data.translated, sourceLanguage: data.source_language || sourceLanguage, targetLanguage: data.target_language || input.targetLanguage };
}
