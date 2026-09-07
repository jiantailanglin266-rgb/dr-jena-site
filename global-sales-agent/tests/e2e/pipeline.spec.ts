import { test, expect } from "@playwright/test";
import { login, apiCall, resetDemoData, pickJob, ADMIN } from "./helpers";

/**
 * Full demo flow through the real UI + API:
 * discovery → analysis → proposal (translated) → approval/send → client reply → reply analysis → AI reply → price floor → deal → CRM
 */
test.describe.configure({ mode: "serial" });

test("login and dashboard render", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("run-discovery")).toBeVisible();
});

test("responsive: mobile drawer navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByTestId("login-email").fill(ADMIN.email);
  await page.getByTestId("login-password").fill(ADMIN.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/); // desktop sidebar (app-name) is hidden on mobile
  await page.getByTestId("mobile-nav-open").click();
  await page.getByTestId("mnav-jobs").click();
  await page.waitForURL(/\/jobs/);
  await expect(page.getByTestId("jobs-table")).toBeVisible();
});

test("discovery + analysis + proposal + send + reply + negotiation + deal → CRM", async ({ page }) => {
  await login(page);
  await resetDemoData(page);

  // 案件取得 (Fake Marketplace API via demo connector) — jobs are already seeded; discovery must be idempotent
  const discovery = await apiCall<{ created: number; summary: { platformKey: string; fetched: number }[] }>(page, "/api/jobs/discover", "POST", { limit: 100, analyze: false });
  expect(discovery.summary.find((s) => s.platformKey === "demo-marketplace")?.fetched).toBe(100);

  const job = await pickJob(page, ["INTERESTED", "PRICE_NEGOTIATION", "ACCEPTANCE"], "de");

  // 案件解析
  await page.goto(`/jobs/${job.id}`);
  await expect(page.getByTestId("job-detail-title")).toContainText(job.projectTitle.slice(0, 20));
  await page.getByTestId("job-analyze").first().click();
  await expect(page.getByTestId("analysis-panel")).toContainText(/Opportunity/i, { timeout: 30_000 });

  // Proposal生成（相手言語で生成 + 自社言語の原文を保存）
  await page.getByTestId("proposal-generate").click();
  await expect(page.getByTestId("proposal-text")).toBeVisible({ timeout: 60_000 });
  const translated = await page.getByTestId("proposal-text").innerText();
  expect(translated.length).toBeGreaterThan(200);
  // Proposal is written in the client's language (German preferred; greeting differs per language)
  const GREETING: Record<string, string> = { de: "Guten Tag", ja: "様", ko: "님께", en: "Dear", fr: "Bonjour", es: "Estimado" };
  expect(translated).toContain(GREETING[job.clientLanguage] ?? "");
  await expect(page.getByTestId("proposal-language")).toContainText(new RegExp(`\\(${job.clientLanguage}\\)`));
  const jobDetail = await apiCall<{ proposal: { id: string; status: string; proposalOriginal: string; proposalTranslated: string; proposedPriceUsd: string } }>(page, `/api/jobs/${job.id}`);
  expect(jobDetail.proposal.proposalOriginal).not.toBe(jobDetail.proposal.proposalTranslated);
  expect(Number(jobDetail.proposal.proposedPriceUsd)).toBeGreaterThanOrEqual(1000);

  // 送信承認（SEMI_AUTO + AUTO platform では自動承認済みの場合もある）
  if (jobDetail.proposal.status === "WAITING_APPROVAL") {
    await page.getByTestId("proposal-approve").click();
  }
  await expect
    .poll(async () => (await apiCall<{ proposal: { status: string } }>(page, `/api/jobs/${job.id}`)).proposal.status, { timeout: 30_000 })
    .toBe("SENT");

  // 返信取得 → 返信解析 (INTERESTED) → AI返信(承認待ち)
  await apiCall(page, "/api/conversations/sync", "POST", {});
  const detail = await apiCall<{ opportunity: { conversation: { id: string } } }>(page, `/api/jobs/${job.id}`);
  const convId = detail.opportunity.conversation.id;
  await page.goto(`/conversations/${convId}`);
  await expect(page.getByTestId("message-inbound").first()).toBeVisible();
  await expect(page.getByTestId("message-category").first()).toContainText("INTERESTED");
  await expect(page.getByTestId("message-approve").first()).toBeVisible();
  await page.getByTestId("message-approve").first().click();
  await expect(page.getByTestId("message-approve")).toHaveCount(0, { timeout: 30_000 });

  // 価格交渉 → Pricing Engine（minimumPrice 以下には下げない）
  await apiCall(page, "/api/conversations/sync", "POST", {});
  await page.reload();
  await expect(page.getByTestId("message-category").last()).toContainText("PRICE NEGOTIATION");
  const thread = await apiCall<{ quotes: { totalUsd: number; status: string }[]; pricingState: { currentOfferUsd: number } }>(page, `/api/conversations/${convId}`);
  expect(thread.quotes.length).toBeGreaterThanOrEqual(1);
  for (const q of thread.quotes) expect(q.totalUsd).toBeGreaterThanOrEqual(1000);
  await expect(page.getByTestId("pricing-state")).toBeVisible();
  await page.getByTestId("message-approve").first().click();
  await expect(page.getByTestId("message-approve")).toHaveCount(0, { timeout: 30_000 });

  // 受注意思 → Deal Summary（人間承認待ち）
  await apiCall(page, "/api/conversations/sync", "POST", {});
  await expect
    .poll(async () => (await apiCall<{ deal: { id: string; status: string } | null }>(page, `/api/conversations/${convId}`)).deal?.status, { timeout: 30_000 })
    .toBe("WAITING_HUMAN_APPROVAL");
  const t2 = await apiCall<{ deal: { id: string } }>(page, `/api/conversations/${convId}`);
  await page.goto(`/crm/deals/${t2.deal.id}`);
  await expect(page.getByTestId("deal-checklist")).toBeVisible();
  for (const key of ["price", "delivery", "scope", "deliverables", "revision_rounds", "payment_terms", "ip_rights", "maintenance", "contract_method"]) {
    const cb = page.getByTestId(`deal-check-${key}`);
    if (!(await cb.isChecked())) await cb.check();
  }
  await page.getByTestId("deal-approve").click();
  await page.getByTestId("deal-approve-confirm").click();
  await expect(page.getByTestId("deal-status")).toContainText("WON", { timeout: 30_000 });

  // CRM登録
  await page.goto("/crm/companies");
  await expect(page.getByTestId("companies-table")).toBeVisible();
  const companies = await apiCall<{ items: { totalWonValueUsd: string }[] }>(page, "/api/crm/companies");
  expect(companies.items.some((c) => Number(c.totalWonValueUsd) > 0)).toBe(true);
  await page.goto("/pipeline");
  await expect(page.getByTestId("kanban-column-WON")).toContainText(job.projectTitle.slice(0, 15));
});

test("price floor: lowball client is declined, never quoted below minimumPrice", async ({ page }) => {
  await login(page);
  const job = await pickJob(page, ["PRICE_NEGOTIATION", "PRICE_NEGOTIATION", "REJECTION"]);
  await apiCall(page, `/api/jobs/${job.id}/analyze`, "POST", {});
  const p = await apiCall<{ id: string; status: string }>(page, `/api/jobs/${job.id}/proposal`, "POST", { length: "SHORT", tone: "PROFESSIONAL" });
  if (p.status === "WAITING_APPROVAL") await apiCall(page, `/api/proposals/${p.id}/approve`, "POST", {});
  const detail = await apiCall<{ opportunity: { conversation: { id: string } } }>(page, `/api/jobs/${job.id}`);
  const convId = detail.opportunity.conversation.id;
  for (let round = 0; round < 2; round++) {
    await apiCall(page, "/api/conversations/sync", "POST", {});
    const thread = await apiCall<{ messages: { id: string; direction: string; sentAt: string | null; approvalStatus: string }[] }>(page, `/api/conversations/${convId}`);
    const draft = thread.messages.filter((m) => m.direction === "OUTBOUND" && !m.sentAt).at(-1)!;
    await apiCall(page, `/api/messages/${draft.id}/approve`, "POST", {});
  }
  const thread = await apiCall<{ quotes: { totalUsd: number; lineItems: { description: string }[] }[] }>(page, `/api/conversations/${convId}`);
  expect(thread.quotes.length).toBeGreaterThanOrEqual(2);
  for (const q of thread.quotes) expect(q.totalUsd).toBeGreaterThanOrEqual(1000);
  expect(thread.quotes.some((q) => q.lineItems.some((l) => l.description.includes("DECLINE")))).toBe(true);
});

test("manual-only platform: proposal generated for human sending, copy + mark sent", async ({ page }) => {
  await login(page);
  const suffix = String(Date.now()).slice(-6); // unique per run (manual job ids derive from the title)
  const imported = await apiCall<{ created: string[] }>(page, "/api/jobs/import", "POST", {
    platform: "coconala",
    analyze: true,
    rows: [{ project_title: `美容サロンのLP制作（予約フォーム付き）#${suffix}`, project_description: "原宿の美容サロンです。新メニューの集客用ランディングページを制作してほしいです。予約フォーム、Instagram連携、スマホ対応必須。写真と原稿はこちらで用意します。納期は1ヶ月以内を希望します。", budget_min: 150000, budget_max: 300000, currency: "JPY", client_country: "JP", client_language: "ja", client_name: "テスト美容サロン", required_skills: "HTML,CSS,LP", payment_verified: "true" }],
  });
  expect(imported.created.length).toBe(1);
  const jobId = imported.created[0];
  const p = await apiCall<{ id: string; sendMode: string; status: string; detectedLanguage: string; proposalTranslated: string }>(page, `/api/jobs/${jobId}/proposal`, "POST", {});
  expect(p.sendMode).toBe("MANUAL_ONLY");
  expect(p.detectedLanguage).toBe("ja");
  expect(p.proposalTranslated).toContain("テスト美容サロン");
  await page.goto(`/proposals/${p.id}`);
  await expect(page.getByTestId("proposal-mark-sent")).toBeVisible();
  await page.getByTestId("proposal-mark-sent").click();
  await expect.poll(async () => (await apiCall<{ status: string }>(page, `/api/proposals/${p.id}`)).status, { timeout: 20_000 }).toBe("SENT");
});

test("automation rule builder + audit log + settings + costs pages", async ({ page }) => {
  await login(page);
  await page.goto("/automation");
  await expect(page.getByTestId("rules-table")).toBeVisible();
  await page.getByTestId("rule-new").click();
  await page.getByTestId("rule-name").fill("E2E high-fit rule");
  await page.getByTestId("rule-add-condition").click();
  await page.getByTestId("rule-dry-run").click();
  await page.getByTestId("rule-save").click();
  await expect(page.getByTestId("rules-table")).toContainText("E2E high-fit rule");
  await page.goto("/audit");
  await expect(page.getByTestId("audit-table")).toBeVisible();
  await expect(page.getByTestId("audit-row").first()).toBeVisible();
  await page.goto("/settings/general");
  await page.getByTestId("settings-app-name").fill("AI DEAL CLOSER");
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("app-name")).toContainText("AI DEAL CLOSER", { timeout: 20_000 });
  await page.getByTestId("settings-app-name").fill("GLOBAL SALES AGENT");
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("app-name")).toContainText("GLOBAL SALES AGENT", { timeout: 20_000 });
  await page.goto("/costs");
  await expect(page.getByTestId("costs-daily")).toBeVisible();
  await page.goto("/analytics");
  await expect(page.getByTestId("analytics-funnel")).toBeVisible();
});
