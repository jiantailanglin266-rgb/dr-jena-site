import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types";
import { estimateTokens } from "./cost";
import {
  mockAnalyzeJob, mockGenerateProposal, mockAnalyzeReply, mockGenerateReply, mockNegotiate, mockDealSummary, mockCompliance, mockTranslate,
  type MockJob, type MockProfile, type MockProposalInput, type MockReplyInput, type MockNegotiationInput, type MockDealInput,
} from "./mock/generators";

/**
 * MockAIProvider — Demo Mode.
 * Produces deterministic, content-aware outputs from the structured `context` passed by each agent,
 * so the whole pipeline (discover → analyse → propose → reply → negotiate → close) runs without API keys.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly defaultModel = "mock-sales-v1";

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const started = Date.now();
    const ctx = (req.context ?? {}) as Record<string, unknown>;
    let out: unknown;
    switch (req.purpose) {
      case "analyze_job":
        out = mockAnalyzeJob(ctx.job as MockJob, ctx.profile as MockProfile);
        break;
      case "generate_proposal":
        out = mockGenerateProposal(ctx as unknown as MockProposalInput);
        break;
      case "analyze_reply":
        out = mockAnalyzeReply(String(ctx.message ?? ""), { proposedPriceUsd: ctx.proposedPriceUsd as number | null, currency: ctx.currency as string, hint: (ctx.hint as string | null) ?? null });
        break;
      case "generate_reply":
        out = mockGenerateReply(ctx as unknown as MockReplyInput);
        break;
      case "negotiate":
        out = mockNegotiate(ctx as unknown as MockNegotiationInput);
        break;
      case "deal_summary":
        out = mockDealSummary(ctx as unknown as MockDealInput);
        break;
      case "compliance_check":
        out = mockCompliance(String(ctx.text ?? ""), (ctx.achievements as string[]) ?? []);
        break;
      case "translate":
        out = { translated: mockTranslate(String(ctx.text ?? ""), String(ctx.targetLanguage ?? "en"), String(ctx.sourceLanguage ?? "en")), source_language: ctx.sourceLanguage, target_language: ctx.targetLanguage };
        break;
      default:
        out = { text: `[mock:${req.purpose}] ${req.messages.at(-1)?.content.slice(0, 200) ?? ""}` };
    }
    const text = req.jsonMode || typeof out === "object" ? JSON.stringify(out) : String(out);
    const inputTokens = estimateTokens(req.system + req.messages.map((m) => m.content).join(""));
    const outputTokens = estimateTokens(text);
    // tiny simulated latency so UI feels natural in demo
    await new Promise((r) => setTimeout(r, 30));
    return { text, model: this.defaultModel, provider: this.name, usage: { inputTokens, outputTokens }, costUsd: 0, latencyMs: Date.now() - started };
  }
}
