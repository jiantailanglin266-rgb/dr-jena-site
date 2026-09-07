import { describe, expect, it } from "vitest";
import { listConnectors, getConnector } from "@/lib/connectors/registry";
import { parseCsv, importRowToJob, manualJobSchema } from "@/lib/connectors/manual-import";
import { mapGenericItem } from "@/lib/connectors/generic-api";
import { mapFreelancerProject } from "@/lib/connectors/freelancer";
import { mapUpworkJob } from "@/lib/connectors/upwork";
import { encryptSecret, decryptSecret, signWebhook, verifyWebhookSignature } from "@/lib/crypto";
import { toUsd, fromUsd } from "@/lib/currency";

describe("Platform Connector Architecture", () => {
  it("registers all connectors with compliance metadata", () => {
    const keys = listConnectors().map((c) => c.key).sort();
    expect(keys).toEqual(["coconala", "crowdworks", "demo-marketplace", "fiverr", "freelancer", "generic-api", "indeed", "lancers", "linkedin", "manual-import", "peopleperhour", "upwork"].sort());
    for (const key of ["coconala", "crowdworks", "lancers"]) {
      const c = getConnector(key);
      expect(c.compliance.automatedSendingPolicy).toBe("PROHIBITED");
      expect(c.compliance.defaultSendMode).toBe("MANUAL_ONLY");
      expect(c.capabilities.sendProposal).toBe(false);
    }
    expect(getConnector("upwork").compliance.officialApi).toBe(true);
    expect(getConnector("upwork").compliance.defaultSendMode).toBe("MANUAL_APPROVAL");
  });
  it("normalises manual CSV imports", () => {
    const rows = parseCsv('project_title,project_description,budget_max,currency,required_skills,client_country\n"LP制作, 至急","予約フォーム付き",300000,JPY,"HTML,CSS",JP\n');
    expect(rows).toHaveLength(1);
    const job = importRowToJob(manualJobSchema.parse({ ...rows[0], platform: "coconala" }));
    expect(job.platform).toBe("coconala");
    expect(job.budget_max).toBe(300000);
    expect(job.required_skills).toEqual(["HTML", "CSS"]);
    expect(job.job_id).toMatch(/^manual-/);
  });
  it("maps generic API items via dot-path mapping", () => {
    const cfg = { url: "https://x", mapping: { job_id: "id", project_title: "title", project_description: "body", budget_max: "budget.max", currency: "budget.currency", required_skills: "tags" }, defaults: { client_language: "en" } };
    const j = mapGenericItem({ id: 7, title: "Site", body: "desc", budget: { max: "1200", currency: "EUR" }, tags: ["a", "b"] }, cfg)!;
    expect(j.job_id).toBe("7");
    expect(j.budget_max).toBe(1200);
    expect(j.currency).toBe("EUR");
    expect(j.client_language).toBe("en");
  });
  it("maps Upwork and Freelancer payloads", () => {
    const u = mapUpworkJob({ id: "~01", title: "T", description: "D", ciphertext: "~abc", amount: { rawValue: "500", currency: "USD" }, client: { location: { country: "US" }, verificationStatus: "VERIFIED", totalFeedback: 4.9 }, totalApplicants: 12 });
    expect(u.payment_verified).toBe(true);
    expect(u.job_url).toContain("~abc");
    const f = mapFreelancerProject({ id: 1, title: "T", description: "D", currency: { code: "AUD" }, budget: { minimum: 100, maximum: 500 }, bid_stats: { bid_count: 3 }, time_submitted: 1700000000, bidperiod: 7 }, { display_name: "Owner", location: { country: { code: "AU" } }, status: { payment_verified: true } });
    expect(f.currency).toBe("AUD");
    expect(f.client_country).toBe("AU");
    expect(f.proposal_deadline).toBeTruthy();
  });
  it("encrypts credentials and verifies webhook signatures", () => {
    const enc = encryptSecret("token-123");
    expect(enc).not.toContain("token-123");
    expect(decryptSecret(enc)).toBe("token-123");
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signWebhook("s", ts, "{}");
    expect(verifyWebhookSignature("s", ts, "{}", sig)).toBe(true);
    expect(verifyWebhookSignature("s", ts, "{}", "sha256=bad")).toBe(false);
  });
  it("converts currencies", () => {
    expect(toUsd(150000, "JPY")).toBeCloseTo(1005, 0);
    expect(fromUsd(1000, "JPY")).toBe(149254);
  });
});
