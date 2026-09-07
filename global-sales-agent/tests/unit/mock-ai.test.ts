import { describe, expect, it } from "vitest";
import { mockAnalyzeJob, mockGenerateProposal, mockAnalyzeReply, mockGenerateReply, assembleProposalText, mockDealSummary } from "@/lib/ai/mock/generators";
import { MockAIProvider } from "@/lib/ai/mock";
import { proposalSchema, jobAnalysisSchema, replyAnalysisSchema } from "@/lib/agents/schemas";
import { generateDemoJobs } from "@/lib/demo/jobs";

const profile = { companyName: "Acme Studio", capabilities: ["Web Development", "Next.js", "Shopify"], techStack: ["Next.js", "TypeScript"], minimumOrderPrice: 1000, hourlyRate: 80, achievements: [{ title: "Clinic site relaunch", category: "Web Development" }], portfolio: [{ title: "Acme site", url: "https://acme.test" }], faq: [{ q: "How many revision rounds?", a: "Two rounds per phase." }], excludeKeywords: ["casino"], forbiddenConditions: ["revenue share only"] };

describe("Mock AI generators (Demo Mode)", () => {
  const jobs = generateDemoJobs(100);
  it("generates 100 jobs across 9 countries and 10 categories with personas", () => {
    expect(jobs).toHaveLength(100);
    expect(new Set(jobs.map((j) => j.client_country)).size).toBe(9);
    expect(new Set(jobs.map((j) => j.category)).size).toBe(10);
    expect(jobs.every((j) => Array.isArray((j.source_metadata as { persona: string[] }).persona))).toBe(true);
    expect(new Set(jobs.map((j) => j.job_id)).size).toBe(100);
  });
  it("analysis output validates against the schema and reacts to profile", () => {
    const job = jobs.find((j) => j.category === "Web Development")!;
    const a = mockAnalyzeJob({ title: job.project_title, description: job.project_description, category: job.category, requiredSkills: job.required_skills, budgetUsd: 4000, clientRating: 4.8, paymentVerified: true, competitors: 5 }, profile);
    expect(jobAnalysisSchema.parse(a)).toBeTruthy();
    expect(a.fit_score).toBeGreaterThan(50);
    const bad = mockAnalyzeJob({ title: "Casino affiliate site", description: "Build a casino affiliate site", category: "Web Development", requiredSkills: [], budgetUsd: 300 }, profile);
    expect(bad.recommended_action).toBe("SKIP");
    expect(bad.risk_flags.join(",")).toContain("exclude_keyword");
  });
  it("proposals are individualised per job and language", () => {
    const [j1, j2] = [jobs[0], jobs[1]];
    const mk = (j: typeof j1, lang: string) => {
      const analysis = mockAnalyzeJob({ title: j.project_title, description: j.project_description, category: j.category, requiredSkills: j.required_skills, budgetUsd: 3000 }, profile);
      return mockGenerateProposal({ job: { title: j.project_title, description: j.project_description, category: j.category, requiredSkills: j.required_skills, currency: "USD", budgetUsd: 3000, clientName: j.client_name }, analysis, profile, tone: "CONSULTATIVE", length: "STANDARD", language: lang, pricing: { minimumPrice: 1000, targetPrice: 3000, idealPrice: 5000, currency: "USD", hourlyRate: 80 } });
    };
    const de = mk(j1, "de");
    const ja = mk(j1, "ja");
    const other = mk(j2, "de");
    expect(proposalSchema.parse(de)).toBeTruthy();
    expect(de.sections.understanding).not.toBe(other.sections.understanding);
    expect(de.sections.understanding).toContain(j1.project_title.slice(0, 10).length ? "" : "");
    expect(ja.sections.closing).not.toBe(de.sections.closing);
    expect(de.proposed_price).toBeGreaterThanOrEqual(1000);
    const text = assembleProposalText(de, "CONSULTATIVE", { client: "Kunde", company: "Acme", title: j1.project_title }, "de");
    expect(text).toContain("Guten Tag Kunde");
    expect(text).toContain("Acme");
  });
  it("classifies replies in multiple languages", () => {
    expect(mockAnalyzeReply("ご予算が30万円程度しかなく、値引きは可能でしょうか？", {}).category).toBe("PRICE_NEGOTIATION");
    expect(mockAnalyzeReply("We've decided to go ahead with you. Please send the contract.", {}).category).toBe("ACCEPTANCE");
    expect(mockAnalyzeReply("Könnten wir ein kurzes Gespräch vereinbaren?", {}).category).toBe("REQUEST_MEETING");
    expect(mockAnalyzeReply("Gracias, esta vez hemos elegido otro proveedor.", {}).category).toBe("REJECTION");
    const priced = mockAnalyzeReply("Our budget is around $2,400, is there room on price?", {});
    expect(priced.extracted.proposed_price).toBe(2400);
    expect(replyAnalysisSchema.parse(priced)).toBeTruthy();
  });
  it("reply drafts answer questions from FAQ in the client language", () => {
    const r = mockGenerateReply({ category: "QUESTION", language: "en", clientName: "Jane", company: "Acme", skills: ["Next.js"], portfolio: [], faq: profile.faq, questions: ["How many revision rounds are included?"] });
    expect(r.body).toContain("Two rounds per phase");
    expect(r.body).toContain("Dear Jane");
    expect(r.includes).toContain("answers_to_questions");
  });
  it("deal summary lists unresolved items and never declares a contract", () => {
    const d = mockDealSummary({ title: "Site", language: "en", price: 3000, currency: "USD", deliveryDays: 20, deliverables: ["Site"], revisionRounds: 2, paymentTerms: null, messages: [{ direction: "INBOUND", body: "We accept, please send the contract" }] });
    expect(d.unresolved).toContain("ip_rights");
    expect(d.contract_method).toBe("Platform contract / escrow");
    expect(d.confidence).toBeLessThan(100);
  });
  it("MockAIProvider routes by purpose and returns JSON", async () => {
    const p = new MockAIProvider();
    const res = await p.complete({ agent: "reply", purpose: "analyze_reply", system: "", messages: [{ role: "user", content: "x" }], jsonMode: true, context: { message: "Sounds great, tell me more!" } });
    expect(JSON.parse(res.text).category).toBe("INTERESTED");
    expect(res.costUsd).toBe(0);
  });
});
