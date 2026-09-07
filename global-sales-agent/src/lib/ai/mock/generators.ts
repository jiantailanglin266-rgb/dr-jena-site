import { fill, getPack, REPLY_KEYWORDS, type Tone } from "./phrases";
import type { JobAnalysisOutput, ProposalOutput, ReplyAnalysisOutput, ReplyDraftOutput, NegotiationOutput, DealSummaryOutput, ComplianceOutput } from "../../agents/schemas";
import { hashString, clamp } from "../../utils";
import { fromUsd, toUsd } from "../../currency";
import { detectLanguage } from "../../language/detect";

/* ───────────── Shared context types (mirrors what agents pass in `context`) ───────────── */

export interface MockJob {
  title: string;
  description: string;
  category?: string | null;
  requiredSkills?: string[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  budgetUsd?: number | null;
  clientRating?: number | null;
  paymentVerified?: boolean;
  competitors?: number | null;
  clientCountry?: string | null;
  clientLanguage?: string | null;
  clientName?: string | null;
  deadline?: string | null;
  clientHistory?: string | null;
}

export interface MockProfile {
  companyName: string;
  capabilities?: string[];
  techStack?: string[];
  strengths?: string[];
  weaknesses?: string[];
  minimumOrderPrice?: number;
  hourlyRate?: number | null;
  excludeKeywords?: string[];
  priorityKeywords?: string[];
  forbiddenConditions?: string[];
  languages?: string[];
  achievements?: { title: string; description?: string; category?: string }[];
  portfolio?: { title: string; url?: string; description?: string; category?: string }[];
  faq?: { q: string; a: string }[];
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

function lower(arr?: string[] | null) {
  return (arr ?? []).map((s) => s.toLowerCase());
}

function overlap(a: string[], b: string[]) {
  const bs = new Set(b);
  return a.filter((x) => bs.has(x));
}

const CATEGORY_HOURS: Record<string, [number, number]> = {
  "Web Development": [60, 200], SaaS: [120, 400], AI: [80, 300], Marketing: [30, 120], Design: [30, 100], Video: [20, 80],
  EC: [80, 250], SEO: [30, 90], Automation: [40, 160], Consulting: [20, 80],
};

/* ───────────── Analyst ───────────── */

const CATEGORY_HINTS: Record<string, RegExp> = {
  SaaS: /saas|multi-?tenant|web app|webアプリ|subscription platform|マルチテナント|플랫폼|웹 애플리케이션/i,
  AI: /\bai\b|chatbot|llm|rag|生成ai|チャットボット|ki-assistent|assistant ia|asistente de ia|챗봇|인공지능/i,
  EC: /shopify|e-?commerce|online store|ecサイト|ec構築|onlineshop|boutique|tienda|쇼핑몰|通販/i,
  SEO: /\bseo\b|検索順位|ranking|keyword|検索最適化/i,
  Video: /video|vidéo|vídeo|movie|ムービー|動画|imagefilm|영상/i,
  Design: /logo|branding|brand identity|identité visuelle|identidad|デザイン|ロゴ|corporate design|로고|브랜드/i,
  Marketing: /ads|advert|instagram|campaign|marketing|広告|運用代行|sns|광고|마케팅/i,
  Automation: /automat|zapier|make\.com|workflow|自動化|kintone|자동화/i,
  Consulting: /consult|roadmap|strategy|戦略|ロードマップ|コンサル|beratung|conseil|consultor|컨설팅|전략/i,
  "Web Development": /website|web site|landing page|homepage|サイト|ランディング|lp制作|relaunch|refonte|rediseño|홈페이지|next\.js|wordpress/i,
};

export function inferCategory(text: string): string | null {
  for (const [cat, re] of Object.entries(CATEGORY_HINTS)) if (re.test(text)) return cat;
  return null;
}

const GOAL_HINTS = /してほしい|したい|お願い|希望|need|want|looking for|we'd like|would like|require|benötigen|suchen|möchten|souhaitons|cherchons|besoin|necesitamos|queremos|buscamos|원합니다|필요|부탁|希望|需要/i;

/** Pick the sentence that best expresses what the client wants (falls back to the longest sentence). */
export function extractGoal(description: string, title: string): string {
  const sentences = description.replace(/\s+/g, " ").split(/(?<=[.!?。！？])\s*/).map((s) => s.trim()).filter((s) => s.length > 8);
  const hinted = sentences.find((s) => GOAL_HINTS.test(s));
  const pick = hinted ?? sentences.sort((a, b) => b.length - a.length)[0] ?? title;
  return pick.slice(0, 180);
}

export function mockAnalyzeJob(job: MockJob, profile: MockProfile): JobAnalysisOutput {
  const seed = hashString(job.title + job.description);
  if (!job.category) job = { ...job, category: inferCategory(`${job.title} ${job.description}`) };
  const rnd = (n: number, spread: number) => ((seed >>> (n % 24)) % (spread * 2 + 1)) - spread; // deterministic jitter
  const skills = job.requiredSkills ?? [];
  const caps = lower([...(profile.capabilities ?? []), ...(profile.techStack ?? []), ...(profile.strengths ?? [])]);
  const matched = overlap(lower(skills), caps);
  const skillFit = skills.length ? (matched.length / skills.length) * 100 : 60;
  const catFit = caps.some((c) => (job.category ?? "").toLowerCase().includes(c) || c.includes((job.category ?? "").toLowerCase())) ? 100 : 55;
  const text = `${job.title} ${job.description}`.toLowerCase();
  const priorityHits = (profile.priorityKeywords ?? []).filter((k) => text.includes(k.toLowerCase())).length;
  const excludeHits = (profile.excludeKeywords ?? []).filter((k) => text.includes(k.toLowerCase()));
  const forbidden = (profile.forbiddenConditions ?? []).filter((k) => text.includes(k.toLowerCase()));
  const weaknessHits = (profile.weaknesses ?? []).filter((k) => text.includes(k.toLowerCase()));

  let fit = clamp(Math.round(skillFit * 0.6 + catFit * 0.4 + priorityHits * 5 - weaknessHits.length * 15 + rnd(1, 4)), 0, 100);
  if (excludeHits.length) fit = Math.min(fit, 25);

  const [hMin, hMax] = CATEGORY_HOURS[job.category ?? ""] ?? [40, 160];
  const descLen = job.description.length;
  const complexity = clamp(descLen / 900, 0.2, 1);
  const hours = Math.round(hMin + (hMax - hMin) * complexity);
  const rate = profile.hourlyRate && profile.hourlyRate > 0 ? profile.hourlyRate : 80;
  const marketPrice = Math.round(hours * rate);
  const budgetUsd = job.budgetUsd ?? toUsd(job.budgetMax ?? job.budgetMin ?? null, job.currency ?? "USD") ?? 0;
  const minOrder = profile.minimumOrderPrice ?? 0;
  let profit = budgetUsd > 0 ? clamp(Math.round((budgetUsd / marketPrice) * 70 + rnd(2, 5)), 0, 100) : 40;
  if (budgetUsd > 0 && budgetUsd < minOrder) profit = Math.min(profit, 15);

  const rating = job.clientRating ?? 0;
  const clientQuality = clamp(Math.round((rating / 5) * 60 + (job.paymentVerified ? 25 : 0) + (job.clientHistory ? 10 : 0) + rnd(3, 4)), 0, 100);
  const competitors = job.competitors ?? 10;
  const competition = clamp(Math.round(Math.min(competitors, 60) / 60 * 100), 0, 100);
  const urgencyWords = /urgent|asap|immediately|急ぎ|至急|dringend|urgente|urgent|紧急|긴급/i.test(text);
  const daysToDeadline = job.deadline ? (new Date(job.deadline).getTime() - Date.now()) / 86400000 : 45;
  const urgency = clamp(Math.round((urgencyWords ? 40 : 10) + (daysToDeadline < 14 ? 40 : daysToDeadline < 30 ? 20 : 5) + rnd(4, 5)), 0, 100);

  const riskFlags: string[] = [];
  if (!job.paymentVerified) riskFlags.push("payment_not_verified");
  if (rating > 0 && rating < 3.5) riskFlags.push("low_client_rating");
  if (budgetUsd > 0 && budgetUsd < marketPrice * 0.5) riskFlags.push("budget_below_market");
  if (budgetUsd > 0 && budgetUsd < minOrder) riskFlags.push("below_minimum_order_price");
  if (descLen < 200) riskFlags.push("vague_requirements");
  if (competitors > 30) riskFlags.push("high_competition");
  if (forbidden.length) riskFlags.push(`forbidden_condition:${forbidden[0]}`);
  if (excludeHits.length) riskFlags.push(`exclude_keyword:${excludeHits[0]}`);
  if (daysToDeadline < 7) riskFlags.push("unrealistic_deadline");
  const risk = clamp(riskFlags.length * 15 + (job.paymentVerified ? 0 : 5) + rnd(5, 3), 0, 100);
  const win = clamp(Math.round(fit * 0.4 + clientQuality * 0.2 + (100 - competition) * 0.25 + profit * 0.15 - risk * 0.2 + rnd(6, 4)), 0, 100);

  const difficulty = hours > 250 ? "VERY_HIGH" : hours > 150 ? "HIGH" : hours > 60 ? "MEDIUM" : "LOW";
  const action = forbidden.length || excludeHits.length ? "SKIP" : fit >= 70 && risk < 40 ? "PROPOSE" : fit >= 50 ? "PROPOSE_WITH_CAUTION" : fit >= 35 ? "REVIEW" : "SKIP";

  const sentences = job.description.replace(/\s+/g, " ").split(/(?<=[.!?。！？])\s*/).filter(Boolean);
  const goal = extractGoal(job.description, job.title);
  const deliverables = extractDeliverables(job);
  const preferred = skills.filter((s) => !matched.includes(s.toLowerCase())).slice(0, 4);

  return {
    summary: `${job.title} — ${job.category ?? "General"} project${job.clientCountry ? ` from ${job.clientCountry}` : ""}. ${sentences.slice(0, 2).join(" ").slice(0, 260)}`,
    client_goal: goal,
    required_deliverables: deliverables,
    required_skills: skills,
    preferred_skills: preferred,
    estimated_difficulty: difficulty,
    estimated_hours: hours,
    estimated_market_price: marketPrice,
    urgency_score: urgency,
    client_quality_score: clientQuality,
    competition_score: competition,
    win_probability: win,
    risk_flags: riskFlags,
    recommended_action: action,
    fit_score: fit,
    profit_score: profit,
    risk_score: risk,
    detected_language: job.clientLanguage || detectLanguage(job.description),
    inferred_category: job.category ?? null,
  };
}

const DELIVERABLE_HINTS: Record<string, string[]> = {
  "Web Development": ["Responsive website", "CMS setup", "Contact & lead forms", "Performance optimisation"],
  SaaS: ["Multi-tenant web app", "Auth & billing", "Admin dashboard", "REST API"],
  AI: ["AI workflow / agent", "Prompt & evaluation set", "Integration with existing tools", "Monitoring dashboard"],
  Marketing: ["Campaign strategy", "Ad creatives", "Landing page", "Monthly performance report"],
  Design: ["Brand identity", "UI design system", "High-fidelity mockups", "Design handoff files"],
  Video: ["Storyboard & script", "Edited video (main cut)", "Social media cut-downs", "Subtitles"],
  EC: ["Online store", "Product catalogue import", "Payment & shipping setup", "Conversion optimisation"],
  SEO: ["Technical SEO audit", "Keyword strategy", "On-page optimisation", "Monthly ranking report"],
  Automation: ["Workflow automation", "System integrations", "Error handling & alerts", "Documentation"],
  Consulting: ["Discovery workshop", "Strategy document", "Roadmap", "Executive summary"],
};

function extractDeliverables(job: MockJob): string[] {
  const hints = DELIVERABLE_HINTS[job.category ?? ""] ?? ["Requirements document", "Implementation", "Testing & handover"];
  const seed = hashString(job.title);
  const n = 2 + (seed % 3);
  const out: string[] = [];
  for (let i = 0; i < n && i < hints.length; i++) out.push(hints[(seed + i) % hints.length]);
  return Array.from(new Set(out));
}

/* ───────────── Proposal ───────────── */

export interface MockProposalInput {
  job: MockJob;
  analysis: JobAnalysisOutput;
  profile: MockProfile;
  tone: Tone;
  length: "SHORT" | "STANDARD" | "DETAILED";
  language: string;
  pricing: { minimumPrice: number; targetPrice: number; idealPrice: number; currency: string; hourlyRate: number };
  memoryInsights?: { bestOpening?: string; bestCta?: string; bestPricePosition?: string };
  variant?: string;
}

const RISK_TEXT: Record<string, Record<string, string>> = {
  payment_not_verified: { ja: "支払い方法が未認証であること", en: "the payment method is not yet verified", zh: "付款方式尚未验证", ko: "결제 수단이 미인증 상태인 점", es: "que el método de pago aún no está verificado", fr: "le moyen de paiement n'est pas encore vérifié", de: "die noch nicht verifizierte Zahlungsmethode", pt: "o método de pagamento ainda não verificado", it: "il metodo di pagamento non ancora verificato" },
  vague_requirements: { ja: "要件がまだ抽象的であること", en: "the requirements are still fairly high-level", zh: "需求描述仍较为笼统", ko: "요구사항이 아직 추상적인 점", es: "que los requisitos aún son generales", fr: "des exigences encore assez générales", de: "noch recht allgemeine Anforderungen", pt: "requisitos ainda genéricos", it: "requisiti ancora generici" },
  budget_below_market: { ja: "ご予算が市場相場を下回る可能性", en: "the budget may sit below market rate for this scope", zh: "预算可能低于市场水平", ko: "예산이 시장 단가보다 낮을 가능성", es: "que el presupuesto podría estar por debajo del mercado", fr: "un budget potentiellement inférieur au marché", de: "ein möglicherweise unter dem Marktniveau liegendes Budget", pt: "um orçamento possivelmente abaixo do mercado", it: "un budget forse inferiore al mercato" },
  unrealistic_deadline: { ja: "納期が非常にタイトであること", en: "the deadline is very tight", zh: "交付期限非常紧张", ko: "납기가 매우 촉박한 점", es: "que el plazo es muy ajustado", fr: "un délai très serré", de: "der sehr enge Zeitplan", pt: "o prazo muito apertado", it: "una scadenza molto stretta" },
  high_competition: { ja: "競合提案が多いこと", en: "there are many competing proposals", zh: "竞争提案较多", ko: "경쟁 제안이 많은 점", es: "que hay muchas propuestas en competencia", fr: "de nombreuses propositions concurrentes", de: "viele konkurrierende Angebote", pt: "muitas propostas concorrentes", it: "molte proposte concorrenti" },
  default: { ja: "スコープの認識齟齬", en: "scope misalignment", zh: "范围理解偏差", ko: "범위 인식 차이", es: "un desajuste de alcance", fr: "un décalage de périmètre", de: "Abweichungen im Umfang", pt: "desalinhamento de âmbito", it: "un disallineamento di ambito" },
};

const GOAL_LEAD: Record<string, string> = { ja: "", en: "", zh: "", ko: "", es: "", fr: "", de: "", pt: "", it: "" };

export function mockGenerateProposal(input: MockProposalInput): ProposalOutput {
  const { job, analysis, profile, tone, length, language, pricing } = input;
  const p = getPack(language);
  const seed = hashString(job.title + language + tone);
  const client = job.clientName || (language === "ja" ? "ご担当者" : language === "ko" ? "담당자" : language === "zh" ? "负责人" : "Hiring Manager");
  const deliverables = (analysis.required_deliverables.length ? analysis.required_deliverables : ["implementation"]).join(language === "ja" ? "、" : ", ");
  const skillsPool = (job.requiredSkills?.length ? job.requiredSkills : profile.techStack ?? []).slice(0, 4);
  const skills = skillsPool.join(language === "ja" ? "・" : ", ") || "modern tooling";
  const achievement = (profile.achievements ?? []).find((a) => (a.category ?? "").toLowerCase() === (job.category ?? "").toLowerCase()) ?? (profile.achievements ?? [])[seed % Math.max(1, (profile.achievements ?? []).length)];
  const hasPortfolio = (profile.portfolio ?? []).length > 0 && length !== "SHORT";

  // Price: anchor on market estimate and budget, respect floor, express in client's currency
  const budgetUsd = job.budgetUsd ?? null;
  let priceUsd = analysis.estimated_market_price;
  if (budgetUsd && budgetUsd > 0) priceUsd = Math.round((priceUsd + budgetUsd) / 2);
  priceUsd = Math.max(priceUsd, pricing.minimumPrice);
  if (input.memoryInsights?.bestPricePosition === "BELOW_MARKET") priceUsd = Math.max(pricing.minimumPrice, Math.round(priceUsd * 0.92));
  const currency = job.currency || pricing.currency || "USD";
  const priceLocal = fromUsd(priceUsd, currency);
  const days = Math.max(7, Math.round(analysis.estimated_hours / 6) + 3);
  const d1 = Math.max(2, Math.round(days * 0.2));
  const d2 = Math.max(3, Math.round(days * 0.5));
  const d3 = Math.max(2, days - 2 - d1 - d2);
  const riskKey = analysis.risk_flags.find((r) => RISK_TEXT[r]) ?? "default";
  const risk = RISK_TEXT[riskKey][language] ?? RISK_TEXT[riskKey].en;
  const ctaType = (input.memoryInsights?.bestCta as keyof typeof p.next) || (["call", "questions", "proposal_review", "trial"] as const)[seed % 4];
  const openingStyle = input.memoryInsights?.bestOpening ?? (tone === "CONSULTATIVE" ? "restate_goal" : tone === "FRIENDLY" ? "warm" : tone === "EXECUTIVE" ? "outcome_first" : "direct");

  const vars = {
    client, company: profile.companyName, title: job.title, goal: GOAL_LEAD[language] + analysis.client_goal.replace(/[.。]$/, ""), deliverables, skills,
    achievement: achievement?.title ?? "", days, d1, d2, d3, price: money(priceLocal, currency), risk, category: job.category ?? "digital",
  };

  const sections = {
    understanding: fill(p.understanding, vars),
    solution: fill(p.solution, vars),
    approach: fill(p.approach, vars),
    similar_experience: achievement ? fill(p.experience, vars) : fill(p.experienceNone, vars),
    timeline: fill(p.timeline, vars),
    delivery: fill(p.delivery, vars),
    pricing: fill(p.pricing, vars),
    risks: fill(p.risks, vars),
    next_action: fill(p.next[ctaType] ?? p.next.call, vars),
    closing: fill(p.closing[tone], vars),
  };
  if (hasPortfolio) {
    const items = (profile.portfolio ?? []).slice(0, 2).map((x) => `- ${x.title}${x.url ? ` (${x.url})` : ""}`).join("\n");
    sections.similar_experience += `\n${items}`;
  }
  if (length === "SHORT") {
    sections.approach = "";
    sections.timeline = "";
    sections.risks = "";
  }
  if (length === "DETAILED") {
    const faq = (profile.faq ?? []).slice(0, 2).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n");
    if (faq) sections.risks += `\n\n${faq}`;
    const strengths = (profile.strengths ?? []).slice(0, 3).join(" / ");
    if (strengths) sections.solution += ` (${strengths})`;
  }
  return {
    language,
    subject: `${job.title} — ${profile.companyName}`,
    sections,
    proposed_price: priceLocal,
    currency,
    delivery_days: days,
    opening_style: openingStyle,
    cta_type: ctaType,
    has_portfolio: hasPortfolio,
  };
}

export function assembleProposalText(out: ProposalOutput, tone: Tone, vars: { client: string; company: string; title: string }, language: string): string {
  const p = getPack(language);
  const parts = [
    fill(p.greeting, vars),
    "",
    fill(p.openings[tone], vars),
    "",
    out.sections.understanding,
    "",
    out.sections.solution,
    out.sections.approach,
    "",
    out.sections.similar_experience,
    "",
    out.sections.timeline,
    out.sections.delivery,
    "",
    out.sections.pricing,
    "",
    out.sections.risks,
    "",
    out.sections.next_action,
    "",
    out.sections.closing,
    "",
    fill(p.signature, vars),
  ];
  return parts.filter((x, i, arr) => !(x === "" && arr[i - 1] === "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ───────────── Reply analysis ───────────── */

const SYMBOL_CURRENCY: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₩": "KRW", "S$": "SGD", "A$": "AUD", "C$": "CAD", "円": "JPY", "ドル": "USD", "원": "KRW", "dollars": "USD", "euros": "EUR", "euro": "EUR" };
const CODES = "USD|EUR|GBP|JPY|KRW|SGD|AUD|CAD|CNY|CHF|INR|BRL|MXN|HKD";

/** Extract a requested price + currency from free text (all supported languages). */
export function extractPrice(text: string): { price: number | null; currency: string | null } {
  const man = text.match(/(\d+(?:\.\d+)?)\s?万\s?(円|ウォン|元)?/);
  if (man) return { price: Math.round(Number(man[1]) * 10000), currency: man[2] === "ウォン" ? "KRW" : man[2] === "元" ? "CNY" : "JPY" };
  const cleaned = text.replace(/,/g, "").replace(/(\d{1,3})\.(\d{3})(?=\D|$)/g, "$1$2").replace(/(\d)\s(?=\d{3}\b)/g, "$1");
  const before = cleaned.match(new RegExp(`(S\\$|A\\$|C\\$|[$€£¥₩]|${CODES})\\s?(\\d{3,8}(?:\\.\\d+)?)`, "i"));
  if (before) return { price: Math.round(Number(before[2])), currency: SYMBOL_CURRENCY[before[1]] ?? before[1].toUpperCase() };
  const after = cleaned.match(new RegExp(`(\\d{3,8}(?:\\.\\d+)?)\\s?(${CODES}|円|ドル|원|dollars|euros|euro|€|\\$)`, "i"));
  if (after) return { price: Math.round(Number(after[1])), currency: SYMBOL_CURRENCY[after[2].toLowerCase()] ?? SYMBOL_CURRENCY[after[2]] ?? after[2].toUpperCase() };
  return { price: null, currency: null };
}

const ORDER = ["ACCEPTANCE", "REJECTION", "PRICE_NEGOTIATION", "REQUEST_MEETING", "REQUEST_PORTFOLIO", "SCHEDULE_NEGOTIATION", "TECHNICAL_QUESTION", "OBJECTION", "INTERESTED", "QUESTION"] as const;

export function mockAnalyzeReply(message: string, ctx: { proposedPriceUsd?: number | null; currency?: string; hint?: string | null }): ReplyAnalysisOutput {
  const text = message;
  let category: ReplyAnalysisOutput["category"] = "UNKNOWN";
  if (ctx.hint && (ORDER as readonly string[]).includes(ctx.hint)) category = ctx.hint as ReplyAnalysisOutput["category"];
  else {
    for (const cat of ORDER) {
      if (REPLY_KEYWORDS[cat].some((re) => re.test(text))) {
        category = cat;
        break;
      }
    }
  }
  const lang = detectLanguage(text);
  const { price, currency } = extractPrice(text);
  const sentiment = category === "REJECTION" ? "NEGATIVE" : category === "OBJECTION" ? "NEGATIVE" : ["ACCEPTANCE", "INTERESTED", "REQUEST_MEETING"].includes(category) ? "POSITIVE" : "NEUTRAL";
  const purchase: Record<string, number> = { ACCEPTANCE: 95, REQUEST_MEETING: 70, INTERESTED: 60, PRICE_NEGOTIATION: 55, SCHEDULE_NEGOTIATION: 55, REQUEST_PORTFOLIO: 50, TECHNICAL_QUESTION: 50, QUESTION: 45, OBJECTION: 30, UNKNOWN: 25, REJECTION: 2 };
  const urgency: Record<string, number> = { ACCEPTANCE: 85, REQUEST_MEETING: 70, SCHEDULE_NEGOTIATION: 75, PRICE_NEGOTIATION: 60, INTERESTED: 50, TECHNICAL_QUESTION: 45, QUESTION: 45, REQUEST_PORTFOLIO: 40, OBJECTION: 40, UNKNOWN: 20, REJECTION: 5 };
  const nba: Record<string, string> = {
    ACCEPTANCE: "Create Deal Summary and request human approval to close",
    REQUEST_MEETING: "Propose 2–3 meeting slots and move to MEETING_REQUESTED",
    INTERESTED: "Send a concise follow-up with next steps and propose a call",
    PRICE_NEGOTIATION: "Run Negotiation Agent within pricing limits; consider scope options",
    SCHEDULE_NEGOTIATION: "Confirm feasibility of the requested timeline and propose a phased plan",
    REQUEST_PORTFOLIO: "Share 2–3 most relevant portfolio items",
    TECHNICAL_QUESTION: "Answer technically with architecture details",
    QUESTION: "Answer each question directly and propose next step",
    OBJECTION: "Address the concern with evidence; offer a trial scope",
    UNKNOWN: "Ask a clarifying question",
    REJECTION: "Thank politely and close as LOST",
  };
  const questions = text.split(/[?？]/).slice(0, -1).map((q) => q.trim().split(/[.。\n]/).pop()?.trim() ?? "").filter((q) => q.length > 5).slice(0, 3);
  const intentMap: Record<string, string> = {
    ACCEPTANCE: "award_project", REQUEST_MEETING: "schedule_meeting", INTERESTED: "learn_more", PRICE_NEGOTIATION: "reduce_price",
    SCHEDULE_NEGOTIATION: "adjust_timeline", REQUEST_PORTFOLIO: "evaluate_capability", TECHNICAL_QUESTION: "validate_approach",
    QUESTION: "clarify", OBJECTION: "de_risk", UNKNOWN: "unclear", REJECTION: "decline",
  };
  return {
    category,
    sentiment,
    intent: intentMap[category],
    purchase_probability: purchase[category],
    urgency: urgency[category],
    next_best_action: nba[category],
    summary: text.replace(/\s+/g, " ").slice(0, 200),
    detected_language: lang,
    extracted: { proposed_price: price, currency, requested_deadline: null, questions },
  };
}

/* ───────────── Reply draft ───────────── */

export interface MockReplyInput {
  category: string;
  language: string;
  clientName: string;
  company: string;
  skills: string[];
  portfolio: { title: string; url?: string }[];
  faq: { q: string; a: string }[];
  questions: string[];
  proposedPrice?: number | null;
  currency?: string;
  deadline?: string | null;
  dealSummaryLines?: string[];
  negotiationBody?: string;
}

const ANSWER_FALLBACK: Record<string, string> = {
  ja: "ご質問の点については、要件定義の段階で具体的に整理し、認識を揃えたうえで進めます。",
  en: "On that point, we will pin down the specifics during requirements confirmation so we are fully aligned before building.",
  zh: "关于该问题，我们会在需求确认阶段具体明确并达成一致后再推进。",
  ko: "해당 사항은 요구사항 확인 단계에서 구체적으로 정리하고 합의한 뒤 진행하겠습니다.",
  es: "Sobre ese punto, concretaremos los detalles en la fase de requisitos para estar alineados antes de construir.",
  fr: "Sur ce point, nous préciserons les détails lors du cadrage afin d'être alignés avant de construire.",
  de: "Diesen Punkt klären wir in der Anforderungsphase im Detail, damit wir vor der Umsetzung vollständig abgestimmt sind.",
  pt: "Sobre esse ponto, definiremos os detalhes na fase de requisitos para estarmos alinhados antes de construir.",
  it: "Su questo punto definiremo i dettagli nella fase di requisiti, così da essere allineati prima di costruire.",
};

const RECAP: Record<string, string> = {
  ja: "改めて、ご提案内容は {price}、納期目安は {deadline} です。ご要望に応じてスコープや工程は柔軟に調整できます。",
  en: "As a quick recap, our proposal stands at {price} with a target delivery of {deadline}; scope and phasing are flexible to your needs.",
  zh: "简要回顾：我们的报价为 {price}，预计交付时间 {deadline}，范围和阶段可根据您的需求灵活调整。",
  ko: "간단히 정리하면, 제안 금액은 {price}, 목표 납기는 {deadline}입니다. 범위와 단계는 필요에 따라 유연하게 조정 가능합니다.",
  es: "Como resumen, nuestra propuesta es {price} con entrega prevista el {deadline}; el alcance y las fases son flexibles.",
  fr: "Pour rappel, notre proposition est de {price} avec une livraison visée le {deadline} ; le périmètre et le phasage restent flexibles.",
  de: "Zur Erinnerung: Unser Angebot liegt bei {price} mit Zieltermin {deadline}; Umfang und Phasen passen wir gern an Ihre Bedürfnisse an.",
  pt: "Em resumo, a nossa proposta é {price} com entrega prevista para {deadline}; âmbito e fases são flexíveis.",
  it: "In sintesi, la nostra proposta è {price} con consegna prevista il {deadline}; ambito e fasi sono flessibili.",
};

export function mockGenerateReply(input: MockReplyInput): ReplyDraftOutput {
  const p = getPack(input.language);
  const tpl = p.reply[input.category] ?? p.reply.UNKNOWN;
  const answers: string[] = [];
  for (const q of input.questions.slice(0, 3)) {
    const faq = input.faq.find((f) => q.toLowerCase().split(/\s+/).some((w) => w.length > 4 && f.q.toLowerCase().includes(w)));
    answers.push(`• ${q}\n  → ${faq ? faq.a : ANSWER_FALLBACK[input.language] ?? ANSWER_FALLBACK.en}`);
  }
  let answer = answers.join("\n");
  if (input.category === "PRICE_NEGOTIATION" && input.negotiationBody) answer = [input.negotiationBody, answer].filter(Boolean).join("\n\n");
  if (!answer) {
    if (input.category === "INTERESTED" && input.proposedPrice) answer = fill(RECAP[input.language] ?? RECAP.en, { price: money(input.proposedPrice, input.currency ?? "USD"), deadline: input.deadline ?? "TBD" });
    else answer = ANSWER_FALLBACK[input.language] ?? ANSWER_FALLBACK.en;
  }
  const portfolio = input.portfolio.slice(0, 3).map((x) => `- ${x.title}${x.url ? ` — ${x.url}` : ""}`).join("\n") || "-";
  const slots = [1, 2, 3].map((d) => {
    const dt = new Date(Date.now() + d * 86400000);
    return `- ${dt.toISOString().slice(0, 10)} 10:00 / 15:00 (JST)`;
  }).join("\n");
  const body = fill(tpl, {
    client: input.clientName, company: input.company, answer, skills: input.skills.slice(0, 3).join(", ") || "modern tooling", portfolio, slots,
    deadline: input.deadline ?? "TBD", summary: (input.dealSummaryLines ?? []).map((l) => `- ${l}`).join("\n") || "-",
  });
  const includes = [
    ...(answers.length ? ["answers_to_questions"] : []),
    ...(input.category === "TECHNICAL_QUESTION" ? ["technical_explanation"] : []),
    ...(input.category === "PRICE_NEGOTIATION" ? ["pricing_explanation"] : []),
    ...(input.category === "REQUEST_PORTFOLIO" ? ["portfolio"] : []),
    ...(input.category === "REQUEST_MEETING" ? ["schedule_slots"] : []),
    ...(input.category === "OBJECTION" ? ["reassurance", "trial_offer"] : []),
    "next_action",
  ];
  const nextStatus: Record<string, string | null> = { REQUEST_MEETING: "MEETING_REQUESTED", PRICE_NEGOTIATION: "NEGOTIATING", ACCEPTANCE: "VERBAL_ACCEPT", REJECTION: "LOST", INTERESTED: "REPLIED", SCHEDULE_NEGOTIATION: "NEGOTIATING" };
  return { language: input.language, body, includes, suggested_next_status: nextStatus[input.category] ?? null };
}

/* ───────────── Negotiation ───────────── */

export interface MockNegotiationInput {
  language: string;
  strategy: NegotiationOutput["strategy"];
  offerPrice: number;
  currency: string;
  discountPct: number;
  targetPrice?: number | null;
  hours: number;
  scope: string[];
  option?: string;
  revisions?: number;
}

export function mockNegotiate(input: MockNegotiationInput): NegotiationOutput {
  const p = getPack(input.language);
  const tpl = p.negotiation[input.strategy] ?? p.negotiation.HOLD;
  const body = fill(tpl, {
    price: money(input.offerPrice, input.currency),
    target: input.targetPrice ? money(input.targetPrice, input.currency) : "",
    discount: input.discountPct,
    hours: input.hours,
    scope: input.scope.join(", ") || "phase-2 features",
    option: input.option ?? "a 30-day post-launch support window",
    revisions: input.revisions ?? 2,
  });
  const rationaleMap: Record<string, string> = {
    HOLD: "Client budget is close to target; hold price and reinforce value.",
    DISCOUNT: "Discount within maximumDiscountPct keeps margin while meeting the client partway.",
    SCOPE_REDUCTION: "Client target is below minimum for full scope; reduce scope to protect the floor.",
    SPLIT_DELIVERY: "Client is hesitant; splitting delivery reduces perceived risk.",
    ADD_OPTION: "Client values scope over price; add an option instead of discounting.",
    MAINTENANCE_CONTRACT: "Convert upfront pressure into recurring revenue.",
    DECLINE: "Requested amount is below minimumPrice; cannot accept.",
  };
  return {
    strategy: input.strategy,
    offer_price: input.offerPrice,
    currency: input.currency,
    discount_pct: input.discountPct,
    scope_changes: input.strategy === "SCOPE_REDUCTION" || input.strategy === "SPLIT_DELIVERY" ? input.scope : [],
    rationale: rationaleMap[input.strategy],
    language: input.language,
    body,
  };
}

/* ───────────── Deal summary ───────────── */

export interface MockDealInput {
  title: string;
  language: string;
  price?: number | null;
  currency: string;
  deliveryDays?: number | null;
  deliverables: string[];
  revisionRounds?: number | null;
  paymentTerms?: string | null;
  messages: { direction: string; body: string }[];
}

export function mockDealSummary(input: MockDealInput): DealSummaryOutput {
  const all = input.messages.map((m) => m.body).join("\n").toLowerCase();
  const ip = /ip|intellectual|知的財産|著作権|rights|urheber|propiedad intelectual|propriété intellectuelle/.test(all) ? "Full IP transfer on final payment" : null;
  const maintenance = /maintenance|保守|support|wartung|mantenimiento|maintenance/.test(all) ? "30 days post-launch support included; monthly plan optional" : null;
  const contract = /contract|契約|platform|escrow|vertrag|contrato|contrat/.test(all) ? "Platform contract / escrow" : null;
  const payment = input.paymentTerms ?? (/50%|milestone|マイルストーン|deposit|着手金/.test(all) ? "50% upfront, 50% on delivery" : null);
  const unresolved: string[] = [];
  if (!input.price) unresolved.push("price");
  if (!input.deliveryDays) unresolved.push("delivery");
  if (!input.revisionRounds) unresolved.push("revision_rounds");
  if (!payment) unresolved.push("payment_terms");
  if (!ip) unresolved.push("ip_rights");
  if (!maintenance) unresolved.push("maintenance");
  if (!contract) unresolved.push("contract_method");
  const p = getPack(input.language);
  const narrative = fill(p.dealNarrative, {
    title: input.title, price: input.price ? money(input.price, input.currency) : "TBD", delivery: input.deliveryDays ? `${input.deliveryDays}d` : "TBD",
    deliverables: input.deliverables.join(", ") || "TBD", unresolved: unresolved.join(", ") || "-",
  });
  return {
    price: input.price ?? null,
    currency: input.currency,
    delivery: input.deliveryDays ? `${input.deliveryDays} days from kickoff` : null,
    scope: input.deliverables.length ? `Delivery of: ${input.deliverables.join(", ")}` : null,
    deliverables: input.deliverables,
    revision_rounds: input.revisionRounds ?? null,
    payment_terms: payment,
    ip_rights: ip,
    maintenance,
    contract_method: contract,
    unresolved,
    confidence: clamp(100 - unresolved.length * 12, 0, 100),
    narrative,
  };
}

/* ───────────── Compliance ───────────── */

export function mockCompliance(text: string, registeredAchievements: string[]): ComplianceOutput {
  const issues: ComplianceOutput["issues"] = [];
  if (/guarantee(d)? (results|ranking|#1)|100% (guarantee|success)|必ず1位|保証します|garantizamos resultados|garantieren wir/i.test(text)) issues.push({ code: "GUARANTEE_CLAIM", severity: "BLOCK", message: "Unconditional result guarantee detected" });
  if (/award[- ]winning|受賞|fortune 500|世界一|no\.?1/i.test(text) && !registeredAchievements.some((a) => /award|受賞|fortune/i.test(a))) issues.push({ code: "UNVERIFIED_CLAIM", severity: "WARN", message: "Claim not backed by a registered achievement" });
  if (text.length < 120) issues.push({ code: "TOO_SHORT", severity: "WARN", message: "Proposal is very short" });
  return { allowed: !issues.some((i) => i.severity === "BLOCK"), issues };
}

/* ───────────── Translation (demo) ───────────── */

export function mockTranslate(text: string, targetLanguage: string, sourceLanguage: string): string {
  if (targetLanguage === sourceLanguage) return text;
  const p = getPack(targetLanguage);
  return `${p.translationNote} ${text}`;
}
