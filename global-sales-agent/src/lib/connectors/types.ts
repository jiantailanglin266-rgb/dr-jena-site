import type { SendMode } from "@prisma/client";

export interface NormalizedJob {
  platform: string;
  job_id: string;
  job_url: string | null;
  client_name: string | null;
  client_country: string | null;
  client_language: string | null;
  project_title: string;
  project_description: string;
  category: string | null;
  required_skills: string[];
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  deadline: string | null;
  proposal_deadline: string | null;
  number_of_competitors: number | null;
  client_rating: number | null;
  client_history: string | null;
  payment_verified: boolean;
  posted_at: string | null;
  raw_text: string;
  source_metadata: Record<string, unknown>;
}

export interface ConnectorContext {
  orgId: string;
  platformAccountId: string;
  credentials: Record<string, string>;
  config: Record<string, unknown>;
  logger?: { info: (msg: string, meta?: unknown) => void; warn: (msg: string, meta?: unknown) => void };
}

export interface DiscoverParams {
  since?: Date | null;
  limit?: number;
  keywords?: string[];
  categories?: string[];
}

export interface SendProposalInput {
  jobExternalId: string;
  text: string;
  price: number | null;
  currency: string;
  deliveryDays: number | null;
  language: string;
  /** Internal reference (proposal id) */
  reference: string;
}

export interface SendResult {
  ok: boolean;
  externalProposalId?: string;
  externalThreadId?: string;
  error?: string;
}

export interface InboundMessage {
  externalThreadId: string;
  externalMessageId: string;
  jobExternalId: string;
  text: string;
  receivedAt: string;
  clientName?: string;
  /** Demo marketplace passes the scripted category to make classification verifiable */
  hint?: string;
}

export type AutomatedSendingPolicy = "ALLOWED" | "RESTRICTED" | "UNKNOWN" | "PROHIBITED";

export interface PlatformConnector {
  key: string;
  displayName: string;
  website?: string;
  capabilities: { discover: boolean; sendProposal: boolean; fetchReplies: boolean; webhook: boolean };
  compliance: {
    officialApi: boolean;
    automatedSendingPolicy: AutomatedSendingPolicy;
    defaultSendMode: SendMode;
    termsUrl?: string;
    notes: string;
  };
  supportedLanguages: string[];
  /** Fields required in credentials (shown in settings UI) */
  credentialFields: { key: string; label: string; secret?: boolean }[];
  discover(ctx: ConnectorContext, params: DiscoverParams): Promise<NormalizedJob[]>;
  sendProposal?(ctx: ConnectorContext, input: SendProposalInput): Promise<SendResult>;
  fetchReplies?(ctx: ConnectorContext, since: Date | null): Promise<InboundMessage[]>;
  verifyWebhook?(rawBody: string, headers: Record<string, string>, secret: string): boolean;
  testConnection(ctx: ConnectorContext): Promise<{ ok: boolean; message: string }>;
}
