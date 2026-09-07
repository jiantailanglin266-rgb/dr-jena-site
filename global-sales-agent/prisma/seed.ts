import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateDemoJobs } from "../src/lib/demo/jobs";
import { encryptJson } from "../src/lib/crypto";
import { listConnectors } from "../src/lib/connectors/registry";
import { toUsd } from "../src/lib/currency";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const prisma = new PrismaClient();

export const DEFAULT_RULES = [
  { name: "High-fit auto proposal", description: "Fit > 85, budget > 1000 USD, rating > 4.5, risk < 20 → create proposal", trigger: "JOB_ANALYZED" as const, priority: 200, conditions: [{ field: "analysis.fitScore", op: "gt", value: 85 }, { field: "job.budgetUsd", op: "gt", value: 1000 }, { field: "job.clientRating", op: "gt", value: 4.5 }, { field: "analysis.riskScore", op: "lt", value: 20 }], actions: [{ type: "CREATE_PROPOSAL", params: { length: "STANDARD", tone: "CONSULTATIVE" } }] },
  { name: "Low opportunity exclusion", description: "Opportunity score < 40 → exclude", trigger: "JOB_ANALYZED" as const, priority: 150, conditions: [{ field: "analysis.opportunityScore", op: "lt", value: 40 }], actions: [{ type: "EXCLUDE_JOB", params: { reason: "opportunity_score_below_40" } }] },
  { name: "Price negotiation reply", description: "Client negotiates price → Negotiation Agent", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "eq", value: "PRICE_NEGOTIATION" }], actions: [{ type: "GENERATE_NEGOTIATION_REPLY", params: {} }] },
  { name: "Questions → AI reply", description: "Questions / technical / portfolio → generate reply", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "in", value: ["QUESTION", "TECHNICAL_QUESTION", "REQUEST_PORTFOLIO", "INTERESTED", "OBJECTION", "SCHEDULE_NEGOTIATION", "UNKNOWN"] }], actions: [{ type: "GENERATE_REPLY", params: {} }] },
  { name: "Meeting requested", description: "Meeting request → status + task + reply", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "eq", value: "REQUEST_MEETING" }], actions: [{ type: "SET_LEAD_STATUS", params: { status: "MEETING_REQUESTED" } }, { type: "CREATE_TASK", params: { title: "Schedule meeting with client" } }, { type: "GENERATE_REPLY", params: {} }] },
  { name: "Acceptance → deal summary", description: "Client accepts → Closing Agent + human approval", trigger: "REPLY_ANALYZED" as const, priority: 100, conditions: [{ field: "reply.category", op: "eq", value: "ACCEPTANCE" }], actions: [{ type: "CREATE_DEAL_SUMMARY", params: {} }, { type: "REQUEST_HUMAN_APPROVAL", params: { title: "Approve deal (WON)", reason: "Client accepted — confirm terms before marking WON" } }] },
];

export const DEMO_PROFILE = {
  companyName: "Dr.Jena Creative & AI Marketing",
  tagline: "30年の美意識で、ブランドを育てる。Web制作 × AIマーケティング × マーケットデザイン",
  services: "コーポレートサイト制作、LP制作、SaaS/Webアプリ開発、AIチャットボット・生成AI活用支援、SNS/広告運用、SEO、ブランディング・デザイン、動画制作、EC構築、DXコンサルティング",
  strengths: ["ブランディング起点の設計", "生成AIを活用した高速制作", "多言語対応（日英中韓）", "美容・ヘルスケア領域の深い知見", "小規模でも一気通貫で対応"],
  weaknesses: ["ネイティブアプリ開発", "大規模基幹システム", "ハードウェア"],
  capabilities: ["Web Development", "SaaS", "AI", "Marketing", "Design", "Video", "EC", "SEO", "Automation", "Consulting", "Next.js", "React", "TypeScript", "WordPress", "Shopify", "Tailwind CSS", "PostgreSQL", "Prisma", "Claude API", "RAG", "Python", "Landing Page", "Branding", "Figma", "Instagram", "Meta Ads", "Google Ads", "Content Marketing", "Zapier", "Make", "Slack API", "DX", "Roadmap"],
  priceRange: "USD 1,500 – 40,000 / project",
  minimumOrderPrice: 1000,
  currency: "USD",
  hourlyRate: 85,
  achievements: [
    { title: "原宿の美容サロン向けコーポレートサイト刷新（問い合わせ2.3倍）", description: "ブランディング起点でサイト全面リニューアル。CVR改善で問い合わせ数2.3倍。", metric: "+130% inquiries", category: "Web Development" },
    { title: "化粧品D2CブランドのShopify構築と定期購入導入", description: "120SKUのECサイト構築、定期購入・CRM連携。", metric: "LTV +40%", category: "EC" },
    { title: "クリニック向けAI問い合わせボット（FAQ 80件・日英対応）", description: "Claude APIとRAGで問い合わせ自動応答、有人エスカレーション付き。", metric: "-60% response time", category: "AI" },
    { title: "美容機器メーカーのSNS・広告運用（12ヶ月）", description: "Instagram/LINE/Meta広告の統合運用、月次レポート。", metric: "ROAS 3.8", category: "Marketing" },
    { title: "旅館グループのブランドムービー制作（日英字幕）", description: "60秒ブランドムービー＋SNSカット。", metric: "1.2M views", category: "Video" },
    { title: "食品メーカーの受注〜請求自動化（kintone/Slack）", description: "Make + スクリプトで業務自動化、月40時間削減。", metric: "-40h/month", category: "Automation" },
    { title: "美容サロンのDXロードマップ策定", description: "3部門ヒアリング、12ヶ月ロードマップ。", metric: "12-month roadmap", category: "Consulting" },
  ],
  portfolio: [
    { title: "Dr.Jena Corporate Site", url: "https://jiantailanglin266-rgb.github.io/dr-jena-site/", description: "Brand-first corporate site with cinematic hero video", category: "Web Development" },
    { title: "AI Marketing Service Page", url: "https://jiantailanglin266-rgb.github.io/dr-jena-site/ai-marketing.html", description: "Service, pricing plans and process", category: "Marketing" },
    { title: "Beauty Brand Page (JenaPro)", url: "https://jiantailanglin266-rgb.github.io/dr-jena-site/beauty.html", description: "Product storytelling page", category: "Design" },
  ],
  caseStudies: [{ title: "問い合わせ2.3倍のサイト刷新", problem: "古いサイトでスマホ離脱が多い", solution: "ブランド再定義 → 情報設計 → 高速なNext.js実装", result: "問い合わせ2.3倍、直帰率-35%" }],
  differentiators: ["美容ブランド運営30年の審美眼", "生成AIワークフローによる短納期", "設計〜運用まで一社完結"],
  languages: ["ja", "en", "zh", "ko"],
  availableHours: "JST 10:00–19:00（月〜金）、緊急時は応相談",
  typicalLeadTime: "LP 2週間 / コーポレートサイト 4〜6週間 / SaaS MVP 8〜12週間",
  staffCount: 8,
  techStack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "PostgreSQL", "Prisma", "WordPress", "Shopify", "Claude API", "OpenAI API", "Python", "Make", "Zapier", "Figma", "Premiere Pro"],
  pastProjects: [],
  faq: [
    { q: "納品後のサポート期間はどのくらいですか？", a: "納品後30日間の無償サポート（軽微な修正・不具合対応）を標準で含みます。以降は月額保守プランをご用意しています。" },
    { q: "修正は何回まで可能ですか？", a: "各工程で2回までの修正を標準としています。追加は実費でご相談可能です。" },
    { q: "着手までに準備するものは？", a: "原稿・写真・ロゴなどの素材、既存アカウント情報、要件のご担当者をご指定ください。" },
    { q: "進捗はどのように共有されますか？", a: "週次のオンライン定例と、Slack/メールでの随時報告で共有します。" },
    { q: "既存システムとのAPI連携は可能ですか？", a: "可能です。REST/GraphQL/Webhook いずれにも対応し、認証・暗号化を含めたセキュリティ設計を行います。" },
    { q: "How do you guarantee quality?", a: "Every phase has a review checkpoint, we ship a staging environment for acceptance, and we include a 30-day post-launch support window. If you are not satisfied at the requirements stage, you can stop with no further obligation." },
    { q: "Can our in-house engineers maintain it afterwards?", a: "Yes — we use mainstream stacks (Next.js/TypeScript/PostgreSQL) and deliver documentation plus a handover session." },
  ],
  forbiddenConditions: ["成果報酬のみ", "revenue share only", "無償トライアル", "アダルト", "gambling"],
  excludeKeywords: ["adult", "casino", "crypto pump", "MLM"],
  priorityKeywords: ["美容", "beauty", "クリニック", "clinic", "ブランド", "brand", "AI", "Shopify"],
};

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@demo.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Demo1234!";

  // Platforms catalog
  for (const c of listConnectors()) {
    await prisma.platform.upsert({
      where: { key: c.key },
      create: { key: c.key, displayName: c.displayName, website: c.website ?? null, officialApi: c.compliance.officialApi, automatedSendingPolicy: c.compliance.automatedSendingPolicy, defaultSendMode: c.compliance.defaultSendMode, termsUrl: c.compliance.termsUrl ?? null, complianceNotes: c.compliance.notes, supportedLanguages: c.supportedLanguages },
      update: { displayName: c.displayName, complianceNotes: c.compliance.notes, automatedSendingPolicy: c.compliance.automatedSendingPolicy, defaultSendMode: c.compliance.defaultSendMode },
    });
  }

  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    create: { name: "Dr.Jena Demo Org", slug: "demo", appName: "GLOBAL SALES AGENT", plan: "BUSINESS", settings: { ...DEFAULT_SETTINGS, defaultLanguage: "ja", automationLevel: "SEMI_AUTO", autoSendEnabled: true, minJobBudgetUsd: 500, minOpportunityScore: 40, aiDailyCostLimitUsd: 25, pricing: { minimumPrice: 1000, targetPrice: 4000, idealPrice: 8000, maximumDiscountPct: 15, currency: "USD", hourlyRate: 85 }, abTesting: { enabled: true, variantBSharePct: 30 } } },
    update: {},
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const users = [
    { email: adminEmail, name: "Demo Admin", role: "ADMIN" as const },
    { email: "manager@demo.local", name: "Demo Manager", role: "MANAGER" as const },
    { email: "sales@demo.local", name: "Demo Sales", role: "SALES" as const },
    { email: "viewer@demo.local", name: "Demo Viewer", role: "VIEWER" as const },
  ];
  for (const u of users) {
    const user = await prisma.user.upsert({ where: { email: u.email }, create: { email: u.email, name: u.name, passwordHash, locale: "ja" }, update: { passwordHash } });
    await prisma.membership.upsert({ where: { userId_organizationId: { userId: user.id, organizationId: org.id } }, create: { userId: user.id, organizationId: org.id, role: u.role }, update: { role: u.role } });
  }

  await prisma.companyProfile.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, ...DEMO_PROFILE }, update: { ...DEMO_PROFILE } });
  await prisma.languageSetting.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, defaultLanguage: "ja", uiLocale: "ja" }, update: {} });

  // Platform accounts: demo marketplace (AUTO), plus manual-only accounts for JP platforms and Upwork/Freelancer placeholders
  const demoPlatform = await prisma.platform.findUniqueOrThrow({ where: { key: "demo-marketplace" } });
  await prisma.platformAccount.upsert({
    where: { organizationId_platformKey: { organizationId: org.id, platformKey: "demo-marketplace" } },
    create: { organizationId: org.id, platformId: demoPlatform.id, platformKey: "demo-marketplace", label: "Demo Marketplace", enabled: true, sendMode: "AUTO", credentialsEncrypted: encryptJson({ apiKey: "demo-key" }) },
    update: { enabled: true, sendMode: "AUTO" },
  });
  for (const key of ["coconala", "crowdworks", "lancers", "upwork", "freelancer"]) {
    const p = await prisma.platform.findUniqueOrThrow({ where: { key } });
    await prisma.platformAccount.upsert({
      where: { organizationId_platformKey: { organizationId: org.id, platformKey: key } },
      create: { organizationId: org.id, platformId: p.id, platformKey: key, label: p.displayName, enabled: key === "upwork" || key === "freelancer" ? false : true, sendMode: p.defaultSendMode },
      update: {},
    });
    await prisma.platformLimit.upsert({ where: { organizationId_platformKey: { organizationId: org.id, platformKey: key } }, create: { organizationId: org.id, platformId: p.id, platformKey: key, dailyLimit: 10, hourlyLimit: 3, maxContactsPerClientPerWeek: 1 }, update: {} });
  }
  await prisma.platformLimit.upsert({ where: { organizationId_platformKey: { organizationId: org.id, platformKey: "demo-marketplace" } }, create: { organizationId: org.id, platformId: demoPlatform.id, platformKey: "demo-marketplace", dailyLimit: 200, hourlyLimit: 100, maxContactsPerClientPerWeek: 5 }, update: { dailyLimit: 200, hourlyLimit: 100, maxContactsPerClientPerWeek: 5 } });

  // Automation rules
  const existingRules = await prisma.automationRule.count({ where: { organizationId: org.id } });
  if (existingRules === 0) {
    for (const r of DEFAULT_RULES) await prisma.automationRule.create({ data: { organizationId: org.id, ...r } });
  }

  // 100 demo jobs (NEW, un-analysed → run Discovery/Analysis from the UI or via API)
  const jobs = generateDemoJobs(100);
  let created = 0;
  for (const j of jobs) {
    const exists = await prisma.job.findUnique({ where: { organizationId_platformKey_externalJobId: { organizationId: org.id, platformKey: j.platform, externalJobId: j.job_id } } });
    if (exists) continue;
    let clientId: string | null = null;
    if (j.client_name) {
      const c = await prisma.client.findFirst({ where: { organizationId: org.id, platformKey: j.platform, name: j.client_name } });
      clientId = c ? c.id : (await prisma.client.create({ data: { organizationId: org.id, name: j.client_name, platformKey: j.platform, country: j.client_country, language: j.client_language, rating: j.client_rating, history: j.client_history, paymentVerified: j.payment_verified } })).id;
    }
    const job = await prisma.job.create({
      data: {
        organizationId: org.id, platformKey: j.platform, externalJobId: j.job_id, jobUrl: j.job_url, clientName: j.client_name, clientCountry: j.client_country, clientLanguage: j.client_language,
        projectTitle: j.project_title, projectDescription: j.project_description, category: j.category, requiredSkills: j.required_skills, budgetMin: j.budget_min, budgetMax: j.budget_max, currency: j.currency,
        budgetUsd: toUsd(j.budget_max ?? j.budget_min, j.currency), deadline: j.deadline ? new Date(j.deadline) : null, proposalDeadline: j.proposal_deadline ? new Date(j.proposal_deadline) : null,
        numberOfCompetitors: j.number_of_competitors, clientRating: j.client_rating, clientHistory: j.client_history, paymentVerified: j.payment_verified, postedAt: j.posted_at ? new Date(j.posted_at) : null,
        rawText: j.raw_text, sourceMetadata: j.source_metadata as object, status: "NEW",
      },
    });
    await prisma.opportunity.create({ data: { organizationId: org.id, jobId: job.id, clientId, title: j.project_title, status: "DISCOVERED", currency: j.currency, estimatedValueUsd: toUsd(j.budget_max ?? j.budget_min, j.currency) } });
    created += 1;
  }

  console.log(`Seed complete: org=${org.slug}, users=${users.length}, jobs created=${created}`);
  console.log(`Login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
