import { withAuth, ok } from "@/lib/api";
import { getFunnel, getDailySeries, byPlatform, byCountry, byLanguage, byCategory, getAbTestReport } from "@/lib/services/analytics";
import { getMemoryInsights } from "@/lib/services/memory";

export const GET = withAuth("analytics:read", async (_req, { user }) => {
  const [funnel, series, platform, country, language, category, ab, memory] = await Promise.all([
    getFunnel(user.orgId), getDailySeries(user.orgId, 30), byPlatform(user.orgId), byCountry(user.orgId), byLanguage(user.orgId), byCategory(user.orgId), getAbTestReport(user.orgId), getMemoryInsights(user.orgId),
  ]);
  return ok({ funnel, series, breakdowns: { platform, country, language, category }, ab, memory });
});
