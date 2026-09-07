import OpenAI from "openai";
import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types";
import { estimateCostUsd } from "./cost";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly defaultModel: string;
  private client: OpenAI;

  constructor(apiKey: string, defaultModel = "gpt-4.1") {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const started = Date.now();
    const model = req.model || this.defaultModel;
    const completion = await this.client.chat.completions.create({
      model,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 4000,
      ...(req.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: req.jsonMode ? `${req.system}\n\nRespond with a single valid JSON object only.` : req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    return {
      text,
      model: completion.model ?? model,
      provider: this.name,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd(completion.model ?? model, inputTokens, outputTokens),
      latencyMs: Date.now() - started,
    };
  }
}
