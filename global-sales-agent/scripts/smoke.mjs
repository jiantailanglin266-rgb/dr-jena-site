import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3100";
const out = process.env.OUT ?? "/tmp/claude-0/-home-user-dr-jena-site/022df62b-8220-5f8e-a0f7-3870942c9ff7/scratchpad";
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 200)));
await page.goto(base + "/login");
await page.getByTestId("login-email").fill("admin@demo.local");
await page.getByTestId("login-password").fill("Demo1234!");
await page.getByTestId("login-submit").click();
await page.waitForURL(/dashboard/, { timeout: 60000 });
const paths = (process.env.PATHS ?? "/dashboard,/jobs,/proposals,/pipeline,/conversations,/crm/companies,/crm/deals,/crm/tasks,/crm/contacts").split(",");
for (const p of paths) {
  const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 90000 });
  const title = await page.locator("h1").first().innerText().catch(() => "(no h1)");
  console.log(res?.status(), p, "→", title.replace(/\n/g, " ").slice(0, 60));
  await page.screenshot({ path: `${out}/shot${p.replace(/\//g, "_")}.png`, fullPage: false });
}
console.log("console errors:", errors.length ? errors : "none");
await browser.close();
