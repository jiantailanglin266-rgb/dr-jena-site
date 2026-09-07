/**
 * Browser-only demo engine: runs the whole AI sales pipeline with the same pure modules the server uses
 * (mock AI generators, demo marketplace jobs, client simulator, scoring, pricing engine). No server, no DB.
 */
import { generateDemoJobs, PERSONAS } from "../lib/demo/jobs";
import { simulateClientReply } from "../lib/demo/client-simulator";
import { DEMO_PROFILE } from "../lib/demo/profile";
import { mockAnalyzeJob, mockGenerateProposal, assembleProposalText, mockAnalyzeReply, mockGenerateReply, mockNegotiate, mockDealSummary, mockCompliance, type MockProfile } from "../lib/ai/mock/generators";
import { computeOpportunityScore } from "../lib/scoring/opportunity";
import { evaluateOffer } from "../lib/pricing/engine";
import { toUsd, fromUsd } from "../lib/currency";
import { detectLanguage } from "../lib/language/detect";
import type { NormalizedJob } from "../lib/connectors/types";
import type { JobAnalysisOutput, ProposalOutput, ReplyAnalysisOutput, DealSummaryOutput } from "../lib/agents/schemas";

export type Tone = "PROFESSIONAL" | "FRIENDLY" | "CONSULTATIVE" | "EXECUTIVE" | "TECHNICAL" | "PREMIUM";
export type Length = "SHORT" | "STANDARD" | "DETAILED";
export type LeadStatus = "DISCOVERED" | "QUALIFIED" | "EXCLUDED" | "PROPOSAL_CREATED" | "PROPOSAL_SENT" | "REPLIED" | "NEGOTIATING" | "MEETING_REQUESTED" | "QUOTE_SENT" | "VERBAL_ACCEPT" | "WON" | "LOST";

export interface Settings {
  minimumPrice: number; targetPrice: number; idealPrice: number; maximumDiscountPct: number; currency: string; hourlyRate: number;
  minOpportunityScore: number; tone: Tone; length: Length; sourceLanguage: string; requireHumanApprovalForPrice: boolean; autoApproveProposals: boolean;
}
export interface Message { id: string; direction: "INBOUND" | "OUTBOUND"; author: "AI" | "HUMAN" | "CLIENT"; body: string; language: string; at: string; sent: boolean; approval: "NOT_REQUIRED" | "PENDING" | "APPROVED"; analysis?: ReplyAnalysisOutput; kind?: string }
export interface Quote { version: number; strategy: string; totalUsd: number; totalLocal: number; currency: string; discountPct: number; rationale: string; needsApproval: boolean; status: "DRAFT" | "SENT" }
export interface Deal { status: "WAITING_HUMAN_APPROVAL" | "WON"; summary: DealSummaryOutput; checklist: { key: string; label: string; value: string | null; confirmed: boolean }[]; amountUsd: number; wonAt?: string }
export interface Lead {
  job: NormalizedJob; status: LeadStatus; analysis?: JobAnalysisOutput & { opportunityScore: number }; excludedReason?: string;
  proposal?: { output: ProposalOutput; text: string; original: string; language: string; tone: Tone; length: Length; priceUsd: number; priceLocal: number; status: "WAITING_APPROVAL" | "APPROVED" | "SENT"; compliance: { allowed: boolean; issues: { code: string; severity: string; message: string }[] }; sentAt?: string };
  messages: Message[]; pricing: { currentOfferUsd: number; discountAppliedPct: number; rounds: number }; quotes: Quote[]; deal?: Deal; log: { at: string; actor: "AI" | "HUMAN" | "CLIENT" | "SYSTEM"; text: string }[];
}
export interface State { settings: Settings; leads: Record<string, Lead>; order: string[]; audit: { at: string; actor: string; action: string; entity: string }[]; aiRuns: number; createdAt: string }

export const DEFAULT_SETTINGS: Settings = { minimumPrice: 1000, targetPrice: 4000, idealPrice: 8000, maximumDiscountPct: 15, currency: "USD", hourlyRate: 85, minOpportunityScore: 55, tone: "CONSULTATIVE", length: "STANDARD", sourceLanguage: "ja", requireHumanApprovalForPrice: true, autoApproveProposals: false };
export const CHECKLIST = [["price", "価格 / Price"], ["delivery", "納期 / Delivery"], ["scope", "業務内容 / Scope"], ["deliverables", "成果物 / Deliverables"], ["revision_rounds", "修正回数 / Revisions"], ["payment_terms", "支払条件 / Payment"], ["ip_rights", "知的財産権 / IP"], ["maintenance", "保守 / Maintenance"], ["contract_method", "契約方法 / Contract"]] as const;
export const LANGUAGE_NAMES: Record<string, string> = { ja: "日本語", en: "English", zh: "中文", ko: "한국어", es: "Español", fr: "Français", de: "Deutsch", pt: "Português", it: "Italiano" };
export { PERSONAS, DEMO_PROFILE };

const profile: MockProfile = { ...DEMO_PROFILE, achievements: DEMO_PROFILE.achievements, portfolio: DEMO_PROFILE.portfolio, faq: DEMO_PROFILE.faq } as unknown as MockProfile;
const now = () => new Date().toISOString();
let seq = 0;
const nid = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function createState(): State {
  const jobs = generateDemoJobs(100, new Date());
  const leads: Record<string, Lead> = {};
  for (const job of jobs) leads[job.job_id] = { job, status: "DISCOVERED", messages: [], pricing: { currentOfferUsd: 0, discountAppliedPct: 0, rounds: 0 }, quotes: [], log: [{ at: now(), actor: "SYSTEM", text: `Discovered on ${job.platform}` }] };
  return { settings: { ...DEFAULT_SETTINGS }, leads, order: jobs.map((j) => j.job_id), audit: [], aiRuns: 0, createdAt: now() };
}

function audit(state: State, actor: string, action: string, entity: string) {
  state.audit.unshift({ at: now(), actor, action, entity });
  if (state.audit.length > 500) state.audit.length = 500;
}

export function analyze(state: State, id: string) {
  const lead = state.leads[id];
  const j = lead.job;
  const a = mockAnalyzeJob({ title: j.project_title, description: j.project_description, category: j.category, requiredSkills: j.required_skills, budgetMin: j.budget_min, budgetMax: j.budget_max, currency: j.currency, budgetUsd: toUsd(j.budget_max ?? j.budget_min, j.currency), clientRating: j.client_rating, paymentVerified: j.payment_verified, competitors: j.number_of_competitors, clientCountry: j.client_country, clientLanguage: j.client_language, clientName: j.client_name, deadline: j.deadline, clientHistory: j.client_history }, { ...profile, minimumOrderPrice: state.settings.minimumPrice, hourlyRate: state.settings.hourlyRate });
  const scores = computeOpportunityScore(a);
  lead.analysis = { ...a, opportunityScore: scores.opportunityScore };
  state.aiRuns += 1;
  const qualified = scores.opportunityScore >= state.settings.minOpportunityScore && a.recommended_action !== "SKIP";
  if (lead.status === "DISCOVERED" || lead.status === "EXCLUDED" || lead.status === "QUALIFIED") {
    lead.status = qualified ? "QUALIFIED" : "EXCLUDED";
    lead.excludedReason = qualified ? undefined : `opportunity ${scores.opportunityScore} < ${state.settings.minOpportunityScore} / ${a.recommended_action}`;
  }
  lead.log.push({ at: now(), actor: "AI", text: `Analyst: Opportunity ${scores.opportunityScore} (fit ${a.fit_score}, risk ${a.risk_score}) → ${qualified ? "QUALIFIED" : "EXCLUDED"}` });
  audit(state, "AI:analyst", qualified ? "job.qualified" : "job.excluded", id);
  return lead;
}

export function analyzeAll(state: State) {
  for (const id of state.order) if (!state.leads[id].analysis) analyze(state, id);
}

export function createProposal(state: State, id: string, opts: { tone?: Tone; length?: Length; language?: string } = {}) {
  const lead = state.leads[id];
  if (!lead.analysis) analyze(state, id);
  const s = state.settings;
  const tone = opts.tone ?? s.tone;
  const length = opts.length ?? s.length;
  const j = lead.job;
  const language = opts.language ?? j.client_language ?? detectLanguage(j.project_description);
  const jobView = { title: j.project_title, description: j.project_description, category: j.category, requiredSkills: j.required_skills, currency: j.currency, budgetUsd: toUsd(j.budget_max ?? j.budget_min, j.currency), clientName: j.client_name };
  const out = mockGenerateProposal({ job: jobView, analysis: lead.analysis!, profile, tone, length, language, pricing: { minimumPrice: s.minimumPrice, targetPrice: s.targetPrice, idealPrice: s.idealPrice, currency: s.currency, hourlyRate: s.hourlyRate } });
  let priceUsd = toUsd(out.proposed_price, out.currency) ?? 0;
  if (priceUsd < s.minimumPrice) priceUsd = s.minimumPrice; // hard floor
  const priceLocal = fromUsd(priceUsd, out.currency);
  out.proposed_price = priceLocal;
  const text = assembleProposalText(out, tone, { client: j.client_name ?? "", company: DEMO_PROFILE.companyName, title: j.project_title }, language);
  const original = language === s.sourceLanguage ? text : `（${LANGUAGE_NAMES[s.sourceLanguage] ?? s.sourceLanguage} 原文 — デモ翻訳）\n${text}`;
  const compliance = mockCompliance(text, DEMO_PROFILE.achievements.map((a) => a.title));
  lead.proposal = { output: out, text, original, language, tone, length, priceUsd, priceLocal, status: compliance.allowed && s.autoApproveProposals ? "APPROVED" : "WAITING_APPROVAL", compliance };
  lead.pricing = { currentOfferUsd: priceUsd, discountAppliedPct: 0, rounds: 0 };
  lead.status = "PROPOSAL_CREATED";
  state.aiRuns += 3; // proposal + translation + compliance
  lead.log.push({ at: now(), actor: "AI", text: `Proposal Agent: ${length}/${tone} in ${LANGUAGE_NAMES[language] ?? language}, ${priceLocal} ${out.currency} (≥ floor $${s.minimumPrice})` });
  audit(state, "AI:proposal", "proposal.generated", id);
  if (lead.proposal.status === "APPROVED") sendProposal(state, id, "AI");
  return lead;
}

export function approveProposal(state: State, id: string) {
  const lead = state.leads[id];
  if (!lead.proposal) return lead;
  lead.proposal.status = "APPROVED";
  audit(state, "HUMAN", "proposal.approved", id);
  return sendProposal(state, id, "HUMAN");
}

export function editProposal(state: State, id: string, text: string) {
  const lead = state.leads[id];
  if (!lead.proposal) return lead;
  lead.proposal.text = text;
  lead.log.push({ at: now(), actor: "HUMAN", text: "Proposal edited by a person (new version)" });
  audit(state, "HUMAN", "proposal.edited", id);
  return lead;
}

function sendProposal(state: State, id: string, actor: "AI" | "HUMAN") {
  const lead = state.leads[id];
  if (!lead.proposal) return lead;
  lead.proposal.status = "SENT";
  lead.proposal.sentAt = now();
  lead.status = "PROPOSAL_SENT";
  lead.messages.push({ id: nid(), direction: "OUTBOUND", author: actor, body: lead.proposal.text, language: lead.proposal.language, at: now(), sent: true, approval: "APPROVED", kind: "proposal" });
  lead.log.push({ at: now(), actor, text: `Sent via ${lead.job.platform} (compliance ok, limits ok)` });
  audit(state, actor === "AI" ? "AI:send-engine" : "HUMAN", "proposal.sent", id);
  return lead;
}

/** The fake client answers whenever our side spoke last. Returns the inbound message or null. */
export function syncReplies(state: State, id: string) {
  const lead = state.leads[id];
  const last = lead.messages.at(-1);
  if (!last || last.direction !== "OUTBOUND" || !last.sent || lead.status === "WON" || lead.status === "LOST") return null;
  const inboundCount = lead.messages.filter((m) => m.direction === "INBOUND").length;
  const persona = (lead.job.source_metadata as { persona: string[] }).persona;
  const cur = fromUsd(lead.pricing.currentOfferUsd || lead.proposal?.priceUsd || 0, lead.job.currency);
  const sim = simulateClientReply({ persona, round: inboundCount, language: lead.job.client_language ?? "en", proposedPrice: cur, currency: lead.job.currency, minimumPriceLocal: fromUsd(state.settings.minimumPrice, lead.job.currency), jobId: lead.job.job_id });
  if (!sim) return null;
  const msg: Message = { id: nid(), direction: "INBOUND", author: "CLIENT", body: sim.text, language: lead.job.client_language ?? "en", at: now(), sent: true, approval: "NOT_REQUIRED" };
  lead.messages.push(msg);
  // Reply Intelligence
  const analysis = mockAnalyzeReply(sim.text, { proposedPriceUsd: lead.pricing.currentOfferUsd, currency: lead.job.currency, hint: sim.category });
  msg.analysis = analysis;
  state.aiRuns += 1;
  const map: Record<string, LeadStatus> = { INTERESTED: "REPLIED", QUESTION: "REPLIED", TECHNICAL_QUESTION: "REPLIED", REQUEST_PORTFOLIO: "REPLIED", PRICE_NEGOTIATION: "NEGOTIATING", SCHEDULE_NEGOTIATION: "NEGOTIATING", OBJECTION: "NEGOTIATING", REQUEST_MEETING: "MEETING_REQUESTED", ACCEPTANCE: "VERBAL_ACCEPT", REJECTION: "LOST", UNKNOWN: "REPLIED" };
  const order: LeadStatus[] = ["PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "VERBAL_ACCEPT", "WON", "LOST"];
  const target = map[analysis.category];
  if (target === "LOST" || order.indexOf(target) > order.indexOf(lead.status)) lead.status = target;
  lead.log.push({ at: now(), actor: "AI", text: `Reply Agent: ${analysis.category} · ${analysis.sentiment} · purchase ${analysis.purchase_probability}% → ${analysis.next_best_action}` });
  audit(state, "AI:reply", `message.analyzed:${analysis.category}`, id);
  // Supervisor defaults
  if (analysis.category === "PRICE_NEGOTIATION") negotiate(state, id);
  else if (analysis.category === "ACCEPTANCE") createDealSummary(state, id);
  else if (analysis.category !== "REJECTION") draftReply(state, id);
  return msg;
}

export function draftReply(state: State, id: string, negotiationBody?: string) {
  const lead = state.leads[id];
  const lastIn = [...lead.messages].reverse().find((m) => m.direction === "INBOUND");
  const category = lastIn?.analysis?.category ?? "UNKNOWN";
  const language = lead.job.client_language ?? "en";
  const out = mockGenerateReply({ category, language, clientName: lead.job.client_name ?? "there", company: DEMO_PROFILE.companyName, skills: lead.job.required_skills, portfolio: DEMO_PROFILE.portfolio, faq: DEMO_PROFILE.faq, questions: lastIn?.analysis?.extracted.questions ?? [], proposedPrice: fromUsd(lead.pricing.currentOfferUsd, lead.job.currency), currency: lead.job.currency, deadline: lead.job.deadline?.slice(0, 10) ?? null, negotiationBody });
  const msg: Message = { id: nid(), direction: "OUTBOUND", author: "AI", body: out.body, language, at: now(), sent: false, approval: "PENDING", kind: category };
  lead.messages.push(msg);
  state.aiRuns += 1;
  lead.log.push({ at: now(), actor: "AI", text: `Reply drafted (${category}) — waiting for human approval` });
  audit(state, "AI:reply", "message.drafted", id);
  return msg;
}

export function negotiate(state: State, id: string) {
  const lead = state.leads[id];
  const s = state.settings;
  const lastIn = [...lead.messages].reverse().find((m) => m.direction === "INBOUND");
  const reqLocal = lastIn?.analysis?.extracted.proposed_price ?? null;
  const reqUsd = reqLocal !== null ? toUsd(reqLocal, lastIn?.analysis?.extracted.currency ?? lead.job.currency) : null;
  const ev = evaluateOffer({ currentOffer: lead.pricing.currentOfferUsd || s.targetPrice, requestedPrice: reqUsd, discountAlreadyAppliedPct: lead.pricing.discountAppliedPct, cfg: { minimumPrice: s.minimumPrice, targetPrice: s.targetPrice, idealPrice: s.idealPrice, maximumDiscountPct: s.maximumDiscountPct, currency: s.currency, hourlyRate: s.hourlyRate }, roundsSoFar: lead.pricing.rounds, requireHumanApprovalForPrice: s.requireHumanApprovalForPrice });
  const deliverables = lead.analysis?.required_deliverables ?? [];
  const scope = deliverables.slice(Math.max(1, Math.ceil(deliverables.length / 2)));
  const out = mockNegotiate({ language: lead.job.client_language ?? "en", strategy: ev.recommended, offerPrice: fromUsd(ev.offerPrice, lead.job.currency), currency: lead.job.currency, discountPct: ev.discountPct, targetPrice: reqLocal, hours: lead.analysis?.estimated_hours ?? 0, scope, revisions: 2 });
  const quote: Quote = { version: lead.quotes.length + 1, strategy: ev.recommended, totalUsd: ev.offerPrice, totalLocal: fromUsd(ev.offerPrice, lead.job.currency), currency: lead.job.currency, discountPct: ev.discountPct, rationale: ev.notes.join(" "), needsApproval: ev.requiresHumanApproval, status: "DRAFT" };
  lead.quotes.push(quote);
  lead.pricing = { currentOfferUsd: ev.offerPrice, discountAppliedPct: lead.pricing.discountAppliedPct + ev.discountPct, rounds: lead.pricing.rounds + 1 };
  state.aiRuns += 1;
  lead.log.push({ at: now(), actor: "AI", text: `Negotiation: client asked ${reqUsd ? "$" + reqUsd : "—"} → ${ev.recommended} at $${ev.offerPrice} (floor $${s.minimumPrice})${ev.requiresHumanApproval ? " — price approval required" : ""}` });
  audit(state, "AI:negotiation", `quote.created:${ev.recommended}`, id);
  return draftReply(state, id, out.body);
}

export function approveMessage(state: State, id: string, messageId: string, body?: string) {
  const lead = state.leads[id];
  const msg = lead.messages.find((m) => m.id === messageId);
  if (!msg || msg.sent) return lead;
  if (body && body.trim()) {
    msg.body = body;
    msg.author = "HUMAN";
  }
  msg.sent = true;
  msg.approval = "APPROVED";
  msg.at = now();
  const q = lead.quotes.find((x) => x.status === "DRAFT");
  if (q) {
    q.status = "SENT";
    if (lead.status !== "LOST" && lead.status !== "WON") lead.status = "QUOTE_SENT";
  }
  lead.log.push({ at: now(), actor: "HUMAN", text: "Reply approved and sent" });
  audit(state, "HUMAN", "message.sent", id);
  return lead;
}

export function rejectMessage(state: State, id: string, messageId: string) {
  const lead = state.leads[id];
  lead.messages = lead.messages.filter((m) => m.id !== messageId || m.sent);
  audit(state, "HUMAN", "message.rejected", id);
  return lead;
}

export function createDealSummary(state: State, id: string) {
  const lead = state.leads[id];
  const q = lead.quotes.at(-1);
  const priceLocal = q ? q.totalLocal : lead.proposal?.priceLocal ?? null;
  const summary = mockDealSummary({ title: lead.job.project_title, language: state.settings.sourceLanguage, price: priceLocal, currency: lead.job.currency, deliveryDays: lead.proposal?.output.delivery_days ?? null, deliverables: lead.analysis?.required_deliverables ?? [], revisionRounds: 2, paymentTerms: q ? (q.strategy === "SPLIT_DELIVERY" ? "Phase-based: 50% per phase" : "50% upfront, 50% on delivery") : null, messages: lead.messages.map((m) => ({ direction: m.direction, body: m.body })) });
  const checklist = CHECKLIST.map(([key, label]) => {
    const v = key === "deliverables" ? (summary.deliverables.length ? summary.deliverables.join(", ") : null) : key === "price" ? (priceLocal ? `${priceLocal} ${lead.job.currency}` : null) : (summary[key as keyof DealSummaryOutput] as string | number | null);
    return { key, label, value: v === null || v === undefined ? null : String(v), confirmed: v !== null && v !== undefined && !summary.unresolved.includes(key) };
  });
  lead.deal = { status: "WAITING_HUMAN_APPROVAL", summary, checklist, amountUsd: toUsd(priceLocal, lead.job.currency) ?? 0 };
  lead.status = "VERBAL_ACCEPT";
  state.aiRuns += 1;
  lead.log.push({ at: now(), actor: "AI", text: `Closing Agent: deal summary (${checklist.filter((c) => c.confirmed).length}/9 confirmed) — waiting for human approval` });
  audit(state, "AI:closing", "deal.summary_created", id);
  return lead;
}

export function approveDeal(state: State, id: string): { ok: boolean; unconfirmed: string[] } {
  const lead = state.leads[id];
  if (!lead.deal) return { ok: false, unconfirmed: [] };
  const unconfirmed = lead.deal.checklist.filter((c) => !c.confirmed).map((c) => c.key);
  if (unconfirmed.length) return { ok: false, unconfirmed };
  lead.deal.status = "WON";
  lead.deal.wonAt = now();
  lead.status = "WON";
  lead.log.push({ at: now(), actor: "HUMAN", text: `Deal WON — $${lead.deal.amountUsd} · CRM: company, contact, kick-off task created` });
  audit(state, "HUMAN", "deal.won", id);
  return { ok: true, unconfirmed: [] };
}

export function markLost(state: State, id: string, reason: string) {
  const lead = state.leads[id];
  lead.status = "LOST";
  lead.excludedReason = reason;
  audit(state, "HUMAN", "opportunity.lost", id);
}

/** Run the whole flow automatically for one lead (human steps auto-approved for the tour). */
export function autoRun(state: State, id: string): Lead {
  const lead = state.leads[id];
  if (!lead.analysis) analyze(state, id);
  if (!lead.proposal) createProposal(state, id);
  if (lead.proposal!.status !== "SENT") approveProposal(state, id);
  for (let i = 0; i < 6; i++) {
    if (lead.status === "WON" || lead.status === "LOST") break;
    if (lead.deal) {
      lead.deal.checklist.forEach((c) => (c.confirmed = true));
      approveDeal(state, id);
      break;
    }
    const pending = lead.messages.find((m) => m.direction === "OUTBOUND" && !m.sent);
    if (pending) approveMessage(state, id, pending.id);
    else if (!syncReplies(state, id)) break;
  }
  return lead;
}

export function stats(state: State) {
  const leads = state.order.map((id) => state.leads[id]);
  const analyzed = leads.filter((l) => l.analysis).length;
  const qualified = leads.filter((l) => l.analysis && l.status !== "EXCLUDED").length;
  const sent = leads.filter((l) => l.proposal?.status === "SENT").length;
  const replied = leads.filter((l) => l.messages.some((m) => m.direction === "INBOUND")).length;
  const negotiating = leads.filter((l) => ["NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "VERBAL_ACCEPT", "WON"].includes(l.status)).length;
  const won = leads.filter((l) => l.status === "WON");
  const revenue = won.reduce((s, l) => s + (l.deal?.amountUsd ?? 0), 0);
  const pipeline = leads.filter((l) => ["PROPOSAL_SENT", "REPLIED", "NEGOTIATING", "MEETING_REQUESTED", "QUOTE_SENT", "VERBAL_ACCEPT"].includes(l.status)).reduce((s, l) => s + (l.pricing.currentOfferUsd || l.proposal?.priceUsd || 0), 0);
  const pending = leads.filter((l) => l.proposal?.status === "WAITING_APPROVAL").length + leads.filter((l) => l.messages.some((m) => m.direction === "OUTBOUND" && !m.sent)).length + leads.filter((l) => l.deal?.status === "WAITING_HUMAN_APPROVAL").length;
  const by = (key: (l: Lead) => string) => {
    const m = new Map<string, { jobs: number; sent: number; replied: number; won: number }>();
    for (const l of leads) {
      const k = key(l);
      const g = m.get(k) ?? { jobs: 0, sent: 0, replied: 0, won: 0 };
      g.jobs++;
      if (l.proposal?.status === "SENT") g.sent++;
      if (l.messages.some((x) => x.direction === "INBOUND")) g.replied++;
      if (l.status === "WON") g.won++;
      m.set(k, g);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.jobs - a.jobs);
  };
  return { total: leads.length, analyzed, qualified, sent, replied, negotiating, won: won.length, revenue, pipeline, pending, replyRate: sent ? (replied / sent) * 100 : 0, winRate: sent ? (won.length / sent) * 100 : 0, aiRuns: state.aiRuns, byCountry: by((l) => l.job.client_country ?? "?"), byLanguage: by((l) => l.job.client_language ?? "?"), byCategory: by((l) => l.job.category ?? "?") };
}
