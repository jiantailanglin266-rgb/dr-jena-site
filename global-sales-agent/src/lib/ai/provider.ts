import { z } from "zod";
import { prisma } from "../db";
import { getOrgSettings, type OrgSettings } from "../settings";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { MockAIProvider } from "./mock";
import { AICostLimitExceeded, type AICompletionRequest, type AICompletionResult, type AIProvider } from "./types";
import { createHash } from "crypto";

export function isDemoMode() {
  return process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1";
}

const registry: Record<string, (settings: OrgSettings) => AIProvider | null> = {
  anthropic: (s) => (process.env.ANTHROPIC_API_KEY ? new AnthropicProvider(process.env.ANTHROPIC_API_KEY, s.aiModel || process.env.AI_DEFAULT_MODEL || "claude-opus-5") : null),
  openai: (s) => (process.env.OPENAI_API_KEY ? new OpenAIProvider(process.env.OPENAI_API_KEY, s.aiModel || process.env.AI_DEFAULT_MODEL || "gpt-4.1") : null),
  mock: () => new MockAIProvider(),
};

/** Register an additional provider (e.g. Gemini) at startup. */
export function registerAIProvider(name: string, factory: (settings: OrgSettings) => AIProvider | null) {
  registry[name] = factory;
}

export function resolveProvider(settings: OrgSettings): AIProvider {
  const wanted = settings.aiProvider !== "auto" ? settings.aiProvider : (process.env.AI_PROVIDER ?? "auto");
  if (wanted !== "auto" && wanted !== "mock") {
    const p = registry[wanted]?.(settings);
    if (p) return p;
  }
  if (wanted === "mock") return new MockAIProvider();
  if (isDemoMode() && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return new MockAIProvider();
  for (const key of ["anthropic", "openai"]) {
    const p = registry[key]?.(settings);
    if (p) return p;
  }
  return new MockAIProvider();
}

export interface AIContext {
  orgId: string;
  settings: OrgSettings;
  provider: AIProvider;
  entityType?: string;
  entityId?: string;
}

export async function createAIContext(orgId: string): Promise<AIContext> {
  const { settings } = await getOrgSettings(orgId);
  return { orgId, settings, provider: resolveProvider(settings) };
}

async function todayCostUsd(orgId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const agg = await prisma.aiRun.aggregate({ where: { organizationId: orgId, createdAt: { gte: start } }, _sum: { costUsd: true } });
  return Number(agg._sum.costUsd ?? 0);
}

/** Run a completion with cost-limit enforcement and ai_runs logging. */
export async function runCompletion(ctx: AIContext, req: Omit<AICompletionRequest, "temperature"> & { temperature?: number }, meta?: { entityType?: string; entityId?: string }): Promise<AICompletionResult & { aiRunId: string }> {
  if (ctx.provider.name !== "mock") {
    const spent = await todayCostUsd(ctx.orgId);
    if (ctx.settings.aiDailyCostLimitUsd > 0 && spent >= ctx.settings.aiDailyCostLimitUsd) {
      await prisma.aiRun.create({
        data: {
          organizationId: ctx.orgId, agent: req.agent, purpose: req.purpose, provider: ctx.provider.name, model: req.model ?? ctx.provider.defaultModel,
          inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, success: false, error: "AICostLimitExceeded",
          entityType: meta?.entityType ?? ctx.entityType, entityId: meta?.entityId ?? ctx.entityId,
        },
      });
      throw new AICostLimitExceeded();
    }
  }
  const full: AICompletionRequest = { temperature: ctx.settings.temperature, model: ctx.settings.aiModel || undefined, ...req };
  const inputDigest = createHash("sha256").update(full.system + JSON.stringify(full.messages)).digest("hex").slice(0, 16);
  try {
    const result = await ctx.provider.complete(full);
    const run = await prisma.aiRun.create({
      data: {
        organizationId: ctx.orgId,
        agent: req.agent,
        purpose: req.purpose,
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        success: true,
        inputDigest,
        outputPreview: result.text.slice(0, 300),
        entityType: meta?.entityType ?? ctx.entityType,
        entityId: meta?.entityId ?? ctx.entityId,
      },
    });
    return { ...result, aiRunId: run.id };
  } catch (err) {
    await prisma.aiRun.create({
      data: {
        organizationId: ctx.orgId, agent: req.agent, purpose: req.purpose, provider: ctx.provider.name, model: full.model ?? ctx.provider.defaultModel,
        inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, success: false, error: err instanceof Error ? err.message.slice(0, 500) : "unknown",
        inputDigest, entityType: meta?.entityType ?? ctx.entityType, entityId: meta?.entityId ?? ctx.entityId,
      },
    });
    throw err;
  }
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("No JSON object found in AI response");
  }
}

/** JSON completion validated by Zod; one repair retry on failure. */
export async function runJson<T extends z.ZodTypeAny>(ctx: AIContext, schema: T, req: Omit<AICompletionRequest, "jsonMode" | "temperature"> & { temperature?: number }, meta?: { entityType?: string; entityId?: string }): Promise<{ data: z.infer<T>; aiRunId: string; costUsd: number }> {
  const first = await runCompletion(ctx, { ...req, jsonMode: true }, meta);
  try {
    const parsed = schema.parse(extractJson(first.text));
    return { data: parsed, aiRunId: first.aiRunId, costUsd: first.costUsd };
  } catch (err) {
    if (ctx.provider.name === "mock") throw err;
    const repair = await runCompletion(
      ctx,
      {
        ...req,
        purpose: `${req.purpose}:repair`,
        jsonMode: true,
        messages: [
          ...req.messages,
          { role: "assistant", content: first.text },
          { role: "user", content: `The JSON above failed validation: ${err instanceof Error ? err.message.slice(0, 500) : "invalid"}. Return a corrected JSON object only.` },
        ],
      },
      meta,
    );
    const parsed = schema.parse(extractJson(repair.text));
    return { data: parsed, aiRunId: repair.aiRunId, costUsd: first.costUsd + repair.costUsd };
  }
}
