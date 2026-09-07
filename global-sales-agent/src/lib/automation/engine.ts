import { prisma } from "../db";
import { conditionSchema, evaluateConditions, type Condition } from "./conditions";
import { actionSchema, type Action } from "./actions";
import { logAudit } from "../audit";
import type { AutomationTrigger, LeadStatus, Prisma } from "@prisma/client";
import { z } from "zod";

export interface RuleContext {
  job?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  reply?: Record<string, unknown>;
  opportunity?: Record<string, unknown>;
  proposal?: Record<string, unknown>;
  org: { automationLevel: string; plan: string; autoSendEnabled: boolean };
  ids: { jobId?: string; opportunityId?: string; proposalId?: string; conversationId?: string; messageId?: string };
}

export interface RuleRunResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actions: { type: string; ok: boolean; detail?: string }[];
  error?: string;
}

export const ruleInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(100),
  trigger: z.enum(["JOB_ANALYZED", "JOB_QUALIFIED", "PROPOSAL_DRAFTED", "REPLY_RECEIVED", "REPLY_ANALYZED", "QUOTE_REQUESTED", "VERBAL_ACCEPT", "SCHEDULE"]),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1),
  stopOnMatch: z.boolean().default(false),
});

/** Evaluate + execute all enabled rules for a trigger. Returns per-rule results and whether anything matched. */
export async function runAutomationRules(orgId: string, trigger: AutomationTrigger, ctx: RuleContext, entity: { type: string; id: string }): Promise<{ results: RuleRunResult[]; matchedAny: boolean }> {
  const rules = await prisma.automationRule.findMany({ where: { organizationId: orgId, trigger, enabled: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
  const results: RuleRunResult[] = [];
  let matchedAny = false;
  for (const rule of rules) {
    const conds = (rule.conditions as Condition[]) ?? [];
    const actions = (rule.actions as Action[]) ?? [];
    let matched = false;
    const actionResults: RuleRunResult["actions"] = [];
    let error: string | undefined;
    try {
      matched = evaluateConditions(conds, ctx);
      if (matched) {
        matchedAny = true;
        for (const action of actions) {
          try {
            const detail = await executeAction(orgId, action, ctx);
            actionResults.push({ type: action.type, ok: true, detail });
          } catch (e) {
            actionResults.push({ type: action.type, ok: false, detail: e instanceof Error ? e.message : String(e) });
          }
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    await prisma.automationRun.create({ data: { organizationId: orgId, ruleId: rule.id, trigger, entityType: entity.type, entityId: entity.id, matched, actionsExecuted: actionResults as unknown as Prisma.InputJsonValue, error } });
    if (matched) await logAudit({ orgId, actorType: "AI", agent: "automation", action: `rule.matched:${rule.name}`, entityType: entity.type, entityId: entity.id, after: { actions: actionResults } });
    results.push({ ruleId: rule.id, ruleName: rule.name, matched, actions: actionResults, error });
    if (matched && rule.stopOnMatch) break;
  }
  return { results, matchedAny };
}

/** Dry-run: evaluate conditions only (no actions). */
export function dryRunRule(conds: Condition[], ctx: RuleContext) {
  return evaluateConditions(conds, ctx);
}

async function executeAction(orgId: string, action: Action, ctx: RuleContext): Promise<string> {
  const p = action.params ?? {};
  switch (action.type) {
    case "CREATE_PROPOSAL": {
      if (!ctx.ids.jobId) throw new Error("jobId missing");
      const { enqueue } = await import("../queue");
      await enqueue("create_proposal", { orgId, jobId: ctx.ids.jobId, options: { length: p.length as never, tone: p.tone as never, variantLabel: p.variant as string | undefined } });
      return "proposal queued";
    }
    case "EXCLUDE_JOB": {
      if (!ctx.ids.jobId) throw new Error("jobId missing");
      await prisma.job.update({ where: { id: ctx.ids.jobId }, data: { status: "EXCLUDED", excludedReason: (p.reason as string) ?? "automation_rule" } });
      await prisma.opportunity.updateMany({ where: { jobId: ctx.ids.jobId, status: { in: ["DISCOVERED", "QUALIFIED"] } }, data: { status: "LOST", lostReason: (p.reason as string) ?? "automation_rule" } });
      return "job excluded";
    }
    case "SET_LEAD_STATUS": {
      if (!ctx.ids.opportunityId) throw new Error("opportunityId missing");
      const status = p.status as LeadStatus;
      if (status === "WON") throw new Error("Rules cannot set WON — human approval required");
      await prisma.opportunity.update({ where: { id: ctx.ids.opportunityId }, data: { status, stageChangedAt: new Date() } });
      return `status → ${status}`;
    }
    case "GENERATE_REPLY": {
      if (!ctx.ids.conversationId) throw new Error("conversationId missing");
      const { enqueue } = await import("../queue");
      await enqueue("generate_reply", { orgId, conversationId: ctx.ids.conversationId, instruction: p.instruction as string | undefined });
      return "reply queued";
    }
    case "GENERATE_NEGOTIATION_REPLY": {
      if (!ctx.ids.conversationId) throw new Error("conversationId missing");
      const { enqueue } = await import("../queue");
      await enqueue("negotiate_reply", { orgId, conversationId: ctx.ids.conversationId });
      return "negotiation queued";
    }
    case "REQUEST_HUMAN_APPROVAL":
    case "CREATE_TASK": {
      await prisma.task.create({ data: { organizationId: orgId, opportunityId: ctx.ids.opportunityId ?? null, title: (p.title as string) ?? (action.type === "REQUEST_HUMAN_APPROVAL" ? "Human approval required" : "Follow up"), description: (p.reason as string) ?? null } });
      return "task created";
    }
    case "APPROVE_PROPOSAL": {
      if (!ctx.ids.proposalId) throw new Error("proposalId missing");
      if (!["SEMI_AUTO", "FULL_AUTO"].includes(ctx.org.automationLevel) || !ctx.org.autoSendEnabled) return "skipped (automation level / auto-send off)";
      const { approveProposal } = await import("../services/proposals");
      await approveProposal(orgId, ctx.ids.proposalId, null, { byAutomation: true });
      return "proposal approved";
    }
    case "CREATE_DEAL_SUMMARY": {
      if (!ctx.ids.opportunityId) throw new Error("opportunityId missing");
      const { enqueue } = await import("../queue");
      await enqueue("deal_summary", { orgId, opportunityId: ctx.ids.opportunityId });
      return "deal summary queued";
    }
    case "NOTIFY": {
      await prisma.activity.create({ data: { organizationId: orgId, opportunityId: ctx.ids.opportunityId ?? null, type: "NOTIFY", title: (p.message as string) ?? "Automation notification", actorType: "AI", actorId: "automation" } });
      return "notified";
    }
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}
