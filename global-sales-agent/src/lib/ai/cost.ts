/** Model pricing (USD per 1M tokens). Override with AI_PRICING_JSON env (same shape). */
export interface ModelPrice {
  input: number;
  output: number;
}

const DEFAULT_PRICING: Record<string, ModelPrice> = {
  // Anthropic
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  // OpenAI (approximate list prices; adjust via AI_PRICING_JSON)
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o3": { input: 2, output: 8 },
  // Mock
  "mock-sales-v1": { input: 0, output: 0 },
};

let cached: Record<string, ModelPrice> | null = null;

export function getPricingTable(): Record<string, ModelPrice> {
  if (cached) return cached;
  let extra: Record<string, ModelPrice> = {};
  try {
    if (process.env.AI_PRICING_JSON) extra = JSON.parse(process.env.AI_PRICING_JSON);
  } catch {
    // ignore
  }
  cached = { ...DEFAULT_PRICING, ...extra };
  return cached;
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const table = getPricingTable();
  const price = table[model] ?? Object.entries(table).find(([k]) => model.startsWith(k))?.[1] ?? { input: 3, output: 15 };
  const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Rough token estimate for providers/mocks that do not return usage */
export function estimateTokens(text: string): number {
  // CJK-heavy text tokenizes ~1 token/char; Latin ~4 chars/token
  let cjk = 0;
  for (const ch of text) if (/[぀-ヿ一-鿿가-힯]/.test(ch)) cjk++;
  const latin = text.length - cjk;
  return Math.ceil(cjk + latin / 4);
}
