import { z } from "zod";

export const actionTypes = ["CREATE_PROPOSAL", "EXCLUDE_JOB", "SET_LEAD_STATUS", "GENERATE_REPLY", "GENERATE_NEGOTIATION_REPLY", "REQUEST_HUMAN_APPROVAL", "CREATE_TASK", "APPROVE_PROPOSAL", "CREATE_DEAL_SUMMARY", "NOTIFY"] as const;
export type ActionType = (typeof actionTypes)[number];

export const actionSchema = z.object({ type: z.enum(actionTypes), params: z.record(z.string(), z.unknown()).default({}) });
export type Action = z.infer<typeof actionSchema>;

export const ACTION_LABELS: Record<ActionType, string> = {
  CREATE_PROPOSAL: "Create proposal (Proposal Agent)",
  EXCLUDE_JOB: "Exclude job",
  SET_LEAD_STATUS: "Set lead status",
  GENERATE_REPLY: "Generate AI reply",
  GENERATE_NEGOTIATION_REPLY: "Generate negotiation reply (Pricing Engine)",
  REQUEST_HUMAN_APPROVAL: "Request human approval (task)",
  CREATE_TASK: "Create task",
  APPROVE_PROPOSAL: "Approve proposal (AUTO platforms only)",
  CREATE_DEAL_SUMMARY: "Create deal summary (Closing Agent)",
  NOTIFY: "Notify (activity log)",
};
