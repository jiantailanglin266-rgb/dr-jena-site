import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getJob } from "@/lib/services/jobs";
import { hasPermission } from "@/lib/rbac";

describe("Tenant isolation & RBAC", () => {
  it("does not expose another organisation's job", async () => {
    const demo = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
    const other = await prisma.organization.upsert({ where: { slug: "other-tenant" }, create: { name: "Other Tenant", slug: "other-tenant" }, update: {} });
    const job = await prisma.job.findFirstOrThrow({ where: { organizationId: demo.id } });
    expect(await getJob(other.id, job.id)).toBeNull();
    expect(await getJob(demo.id, job.id)).not.toBeNull();
  });
  it("role matrix", () => {
    expect(hasPermission("VIEWER", "proposal:approve")).toBe(false);
    expect(hasPermission("SALES", "proposal:create")).toBe(true);
    expect(hasPermission("SALES", "deal:approve")).toBe(false);
    expect(hasPermission("MANAGER", "deal:approve")).toBe(true);
    expect(hasPermission("MANAGER", "org:members")).toBe(false);
    expect(hasPermission("ADMIN", "org:members")).toBe(true);
  });
});
