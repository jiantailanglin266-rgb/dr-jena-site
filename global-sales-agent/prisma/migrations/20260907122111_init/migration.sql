-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'SALES', 'VIEWER');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SendMode" AS ENUM ('AUTO', 'MANUAL_APPROVAL', 'MANUAL_ONLY');

-- CreateEnum
CREATE TYPE "AutomatedSendingPolicy" AS ENUM ('ALLOWED', 'RESTRICTED', 'UNKNOWN', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'ANALYZED', 'QUALIFIED', 'EXCLUDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'AI_REVIEWED', 'WAITING_APPROVAL', 'APPROVED', 'SCHEDULED', 'SENT', 'FAILED', 'REPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProposalLength" AS ENUM ('SHORT', 'STANDARD', 'DETAILED');

-- CreateEnum
CREATE TYPE "ProposalTone" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'CONSULTATIVE', 'EXECUTIVE', 'TECHNICAL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('DISCOVERED', 'QUALIFIED', 'PROPOSAL_CREATED', 'PROPOSAL_SENT', 'REPLIED', 'NEGOTIATING', 'MEETING_REQUESTED', 'QUOTE_SENT', 'FINAL_NEGOTIATION', 'VERBAL_ACCEPT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ReplyCategory" AS ENUM ('INTERESTED', 'QUESTION', 'PRICE_NEGOTIATION', 'SCHEDULE_NEGOTIATION', 'TECHNICAL_QUESTION', 'REQUEST_PORTFOLIO', 'REQUEST_MEETING', 'OBJECTION', 'REJECTION', 'ACCEPTANCE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "AuthorType" AS ENUM ('AI', 'HUMAN', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'SENT', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('SUMMARY_DRAFT', 'WAITING_HUMAN_APPROVAL', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('JOB_ANALYZED', 'JOB_QUALIFIED', 'PROPOSAL_DRAFTED', 'REPLY_RECEIVED', 'REPLY_ANALYZED', 'QUOTE_REQUESTED', 'VERBAL_ACCEPT', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "AutomationLevel" AS ENUM ('MANUAL', 'ASSISTED', 'SEMI_AUTO', 'FULL_AUTO');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "appName" TEXT NOT NULL DEFAULT 'GLOBAL SALES AGENT',
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ja',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SALES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tagline" TEXT,
    "services" TEXT NOT NULL DEFAULT '',
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceRange" TEXT,
    "minimumOrderPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "hourlyRate" DECIMAL(12,2),
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "portfolio" JSONB NOT NULL DEFAULT '[]',
    "caseStudies" JSONB NOT NULL DEFAULT '[]',
    "differentiators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availableHours" TEXT,
    "typicalLeadTime" TEXT,
    "staffCount" INTEGER,
    "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pastProjects" JSONB NOT NULL DEFAULT '[]',
    "faq" JSONB NOT NULL DEFAULT '[]',
    "forbiddenConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "website" TEXT,
    "officialApi" BOOLEAN NOT NULL DEFAULT false,
    "automatedSendingPolicy" "AutomatedSendingPolicy" NOT NULL DEFAULT 'UNKNOWN',
    "defaultSendMode" "SendMode" NOT NULL DEFAULT 'MANUAL_ONLY',
    "termsUrl" TEXT,
    "complianceNotes" TEXT NOT NULL DEFAULT '',
    "supportedLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sendMode" "SendMode" NOT NULL DEFAULT 'MANUAL_APPROVAL',
    "credentialsEncrypted" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastDiscoveryAt" TIMESTAMP(3),
    "lastReplyPollAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_limits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 20,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 5,
    "maxContactsPerClientPerWeek" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "jobUrl" TEXT,
    "clientName" TEXT,
    "clientCountry" TEXT,
    "clientLanguage" TEXT,
    "projectTitle" TEXT NOT NULL,
    "projectDescription" TEXT NOT NULL,
    "category" TEXT,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budgetMin" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "budgetUsd" DECIMAL(14,2),
    "deadline" TIMESTAMP(3),
    "proposalDeadline" TIMESTAMP(3),
    "numberOfCompetitors" INTEGER,
    "clientRating" DECIMAL(3,2),
    "clientHistory" TEXT,
    "paymentVerified" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "rawText" TEXT NOT NULL DEFAULT '',
    "sourceMetadata" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',
    "excludedReason" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_analyses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "clientGoal" TEXT NOT NULL,
    "requiredDeliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedDifficulty" TEXT NOT NULL,
    "estimatedHours" INTEGER NOT NULL,
    "estimatedMarketPrice" DECIMAL(14,2) NOT NULL,
    "urgencyScore" INTEGER NOT NULL,
    "clientQualityScore" INTEGER NOT NULL,
    "competitionScore" INTEGER NOT NULL,
    "winProbability" INTEGER NOT NULL,
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedAction" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "profitScore" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "detectedLanguage" TEXT NOT NULL DEFAULT 'en',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "aiRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platformKey" TEXT,
    "externalClientId" TEXT,
    "country" TEXT,
    "language" TEXT,
    "rating" DECIMAL(3,2),
    "history" TEXT,
    "paymentVerified" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "industry" TEXT,
    "notes" TEXT,
    "totalWonValueUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'DISCOVERED',
    "estimatedValueUsd" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "ownerUserId" TEXT,
    "lostReason" TEXT,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "sendMode" "SendMode" NOT NULL DEFAULT 'MANUAL_APPROVAL',
    "length" "ProposalLength" NOT NULL DEFAULT 'STANDARD',
    "tone" "ProposalTone" NOT NULL DEFAULT 'CONSULTATIVE',
    "variantLabel" TEXT NOT NULL DEFAULT 'A',
    "detectedLanguage" TEXT NOT NULL DEFAULT 'en',
    "sourceLanguage" TEXT NOT NULL DEFAULT 'ja',
    "proposalOriginal" TEXT NOT NULL,
    "proposalTranslated" TEXT NOT NULL,
    "structured" JSONB NOT NULL DEFAULT '{}',
    "proposedPriceUsd" DECIMAL(14,2),
    "proposedPrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "proposedDeliveryDays" INTEGER,
    "complianceResult" JSONB NOT NULL DEFAULT '{}',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "externalProposalId" TEXT,
    "aiRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "proposalOriginal" TEXT NOT NULL,
    "proposalTranslated" TEXT NOT NULL,
    "structured" JSONB NOT NULL DEFAULT '{}',
    "length" "ProposalLength" NOT NULL,
    "tone" "ProposalTone" NOT NULL,
    "changeReason" TEXT,
    "authorType" "AuthorType" NOT NULL DEFAULT 'AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "externalThreadId" TEXT,
    "clientLanguage" TEXT NOT NULL DEFAULT 'en',
    "summary" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "pricingState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "authorType" "AuthorType" NOT NULL,
    "authorUserId" TEXT,
    "externalMessageId" TEXT,
    "language" TEXT,
    "body" TEXT NOT NULL,
    "bodyTranslated" TEXT,
    "replyCategory" "ReplyCategory",
    "analysis" JSONB,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "approvedByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "aiRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "totalAmountUsd" DECIMAL(14,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "deliveryDays" INTEGER,
    "paymentTerms" TEXT,
    "revisionRounds" INTEGER,
    "notes" TEXT,
    "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "clientId" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'SUMMARY_DRAFT',
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountUsd" DECIMAL(14,2) NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "actorType" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "assigneeUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "trigger" "AutomationTrigger" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "stopOnMatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "actionsExecuted" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(12,6) NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "inputDigest" TEXT,
    "outputPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ja',
    "supportedLanguages" TEXT[] DEFAULT ARRAY['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'pt', 'it']::TEXT[],
    "translateProposals" BOOLEAN NOT NULL DEFAULT true,
    "translateReplies" BOOLEAN NOT NULL DEFAULT true,
    "uiLocale" TEXT NOT NULL DEFAULT 'ja',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_memory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "category" TEXT,
    "country" TEXT,
    "language" TEXT NOT NULL,
    "tone" "ProposalTone" NOT NULL,
    "length" "ProposalLength" NOT NULL,
    "openingStyle" TEXT NOT NULL,
    "ctaType" TEXT NOT NULL,
    "pricePosition" TEXT NOT NULL,
    "hasPortfolio" BOOLEAN NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "won" BOOLEAN NOT NULL DEFAULT false,
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "userId" TEXT,
    "agent" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_organizationId_idx" ON "memberships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "company_profiles_organizationId_key" ON "company_profiles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_key_key" ON "platforms"("key");

-- CreateIndex
CREATE INDEX "platform_accounts_organizationId_idx" ON "platform_accounts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_organizationId_platformKey_key" ON "platform_accounts"("organizationId", "platformKey");

-- CreateIndex
CREATE UNIQUE INDEX "platform_limits_organizationId_platformKey_key" ON "platform_limits"("organizationId", "platformKey");

-- CreateIndex
CREATE INDEX "jobs_organizationId_status_idx" ON "jobs"("organizationId", "status");

-- CreateIndex
CREATE INDEX "jobs_organizationId_platformKey_idx" ON "jobs"("organizationId", "platformKey");

-- CreateIndex
CREATE INDEX "jobs_organizationId_postedAt_idx" ON "jobs"("organizationId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_organizationId_platformKey_externalJobId_key" ON "jobs"("organizationId", "platformKey", "externalJobId");

-- CreateIndex
CREATE UNIQUE INDEX "job_analyses_jobId_key" ON "job_analyses"("jobId");

-- CreateIndex
CREATE INDEX "job_analyses_organizationId_opportunityScore_idx" ON "job_analyses"("organizationId", "opportunityScore");

-- CreateIndex
CREATE INDEX "clients_organizationId_idx" ON "clients"("organizationId");

-- CreateIndex
CREATE INDEX "clients_organizationId_platformKey_externalClientId_idx" ON "clients"("organizationId", "platformKey", "externalClientId");

-- CreateIndex
CREATE INDEX "contacts_organizationId_clientId_idx" ON "contacts"("organizationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_jobId_key" ON "opportunities"("jobId");

-- CreateIndex
CREATE INDEX "opportunities_organizationId_status_idx" ON "opportunities"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_jobId_key" ON "proposals"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_opportunityId_key" ON "proposals"("opportunityId");

-- CreateIndex
CREATE INDEX "proposals_organizationId_status_idx" ON "proposals"("organizationId", "status");

-- CreateIndex
CREATE INDEX "proposals_organizationId_platformKey_sentAt_idx" ON "proposals"("organizationId", "platformKey", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_proposalId_version_key" ON "proposal_versions"("proposalId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_opportunityId_key" ON "conversations"("opportunityId");

-- CreateIndex
CREATE INDEX "conversations_organizationId_lastMessageAt_idx" ON "conversations"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_organizationId_approvalStatus_idx" ON "messages"("organizationId", "approvalStatus");

-- CreateIndex
CREATE INDEX "quotes_organizationId_opportunityId_idx" ON "quotes"("organizationId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_opportunityId_key" ON "deals"("opportunityId");

-- CreateIndex
CREATE INDEX "deals_organizationId_status_idx" ON "deals"("organizationId", "status");

-- CreateIndex
CREATE INDEX "activities_organizationId_createdAt_idx" ON "activities"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "activities_opportunityId_createdAt_idx" ON "activities"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_organizationId_status_idx" ON "tasks"("organizationId", "status");

-- CreateIndex
CREATE INDEX "automation_rules_organizationId_trigger_enabled_idx" ON "automation_rules"("organizationId", "trigger", "enabled");

-- CreateIndex
CREATE INDEX "automation_runs_organizationId_createdAt_idx" ON "automation_runs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_runs_organizationId_createdAt_idx" ON "ai_runs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_runs_organizationId_agent_idx" ON "ai_runs"("organizationId", "agent");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_organizationId_agent_key" ON "prompt_templates"("organizationId", "agent");

-- CreateIndex
CREATE UNIQUE INDEX "language_settings_organizationId_key" ON "language_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_memory_proposalId_key" ON "performance_memory"("proposalId");

-- CreateIndex
CREATE INDEX "performance_memory_organizationId_platformKey_idx" ON "performance_memory"("organizationId", "platformKey");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_entityType_entityId_idx" ON "audit_logs"("organizationId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_limits" ADD CONSTRAINT "platform_limits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_limits" ADD CONSTRAINT "platform_limits_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_settings" ADD CONSTRAINT "language_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_memory" ADD CONSTRAINT "performance_memory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
