import type { Plan } from "@prisma/client";

export interface PlanLimits {
  maxUsers: number;
  maxPlatformAccounts: number;
  maxProposalsPerDay: number;
  maxJobsPerDiscovery: number;
  aiDailyCostLimitUsd: number;
  automationRules: number;
  abTesting: boolean;
  fullAutomation: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  STARTER: { maxUsers: 2, maxPlatformAccounts: 2, maxProposalsPerDay: 10, maxJobsPerDiscovery: 50, aiDailyCostLimitUsd: 5, automationRules: 3, abTesting: false, fullAutomation: false },
  PRO: { maxUsers: 5, maxPlatformAccounts: 5, maxProposalsPerDay: 40, maxJobsPerDiscovery: 200, aiDailyCostLimitUsd: 25, automationRules: 15, abTesting: true, fullAutomation: false },
  BUSINESS: { maxUsers: 20, maxPlatformAccounts: 15, maxProposalsPerDay: 150, maxJobsPerDiscovery: 1000, aiDailyCostLimitUsd: 100, automationRules: 50, abTesting: true, fullAutomation: true },
  ENTERPRISE: { maxUsers: 1000, maxPlatformAccounts: 100, maxProposalsPerDay: 2000, maxJobsPerDiscovery: 10000, aiDailyCostLimitUsd: 1000, automationRules: 500, abTesting: true, fullAutomation: true },
};

export const PLAN_LABELS: Record<Plan, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  BUSINESS: "Business",
  ENTERPRISE: "Enterprise",
};
