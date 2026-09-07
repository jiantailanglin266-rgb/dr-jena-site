export type AIRole = "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AICompletionRequest {
  /** Agent name (scout / analyst / proposal / reply / negotiation / closing / translation / compliance / supervisor) */
  agent: string;
  /** Purpose key — used by the mock provider to route to deterministic generators */
  purpose: string;
  system: string;
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Structured context handed to the mock provider (ignored by real providers) */
  context?: Record<string, unknown>;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AICompletionResult {
  text: string;
  model: string;
  provider: string;
  usage: AIUsage;
  costUsd: number;
  latencyMs: number;
}

export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(req: AICompletionRequest): Promise<AICompletionResult>;
}

export class AICostLimitExceeded extends Error {
  constructor(message = "AICostLimitExceeded: daily AI cost limit reached") {
    super(message);
    this.name = "AICostLimitExceeded";
  }
}
