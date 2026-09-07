import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? "admin@demo.local", password: process.env.SEED_ADMIN_PASSWORD ?? "Demo1234!" };

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(ADMIN.email);
  await page.getByTestId("login-password").fill(ADMIN.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByTestId("app-name")).toBeVisible();
}

/** Same-origin JSON API call from the browser context (carries the session cookie + Origin). */
export async function apiCall<T = unknown>(page: Page, path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await page.evaluate(
    async ({ path, method, body }) => {
      const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || j.ok === false) throw new Error(j.error ?? `HTTP ${r.status}`);
      return j.data;
    },
    { path, method, body },
  );
  return res as T;
}

export async function resetDemoData(page: Page) {
  await apiCall(page, "/api/demo/reset", "POST", {});
}

export type Persona = string;
export async function pickJob(page: Page, persona: string[], preferLang?: string): Promise<{ id: string; projectTitle: string; clientLanguage: string; currency: string; opportunity: { id: string } }> {
  type Row = { id: string; projectTitle: string; clientLanguage: string; currency: string; sourceMetadata: { persona: string[] }; status: string; opportunity: { id: string } };
  const items: Row[] = [];
  for (let p = 1; p <= 3; p++) {
    const res = await apiCall<{ items: Row[]; total: number }>(page, `/api/jobs?status=NEW&pageSize=100&sort=posted&page=${p}`);
    items.push(...res.items);
    if (items.length >= res.total) break;
  }
  const wanted = persona.join(",");
  const candidates = items.filter((j) => (j.sourceMetadata?.persona ?? []).join(",") === wanted);
  const job = (preferLang ? candidates.find((j) => j.clientLanguage === preferLang) : undefined) ?? candidates[0];
  if (!job) throw new Error(`No NEW job with persona ${wanted}`);
  return job;
}

export { expect };
export type { APIRequestContext };
