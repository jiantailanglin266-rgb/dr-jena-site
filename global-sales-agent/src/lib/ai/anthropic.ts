import Anthropic from "@anthropic-ai/sdk";
import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types";
import { estimateCostUsd } from "./cost";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly defaultModel: string;
  private client: Anthropic;

  constructor(apiKey: string, defaultModel = "claude-opus-5") {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = defaultModel;
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const started = Date.now();
    const model = req.model || this.defaultModel;
    const system = req.jsonMode ? `${req.system}\n\nRespond with a single valid JSON object only. No markdown fences, no commentary.` : req.system;
    const response = await this.client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 8000,
      system,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    if (response.stop_reason === "refusal") {
      throw new Error("AI provider refused the request");
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    return {
      text,
      model: response.model,
      provider: this.name,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd(response.model, inputTokens, outputTokens),
      latencyMs: Date.now() - started,
    };
  }
}
