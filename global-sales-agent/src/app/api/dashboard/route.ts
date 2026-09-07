import { withAuth, ok } from "@/lib/api";
import { getDashboardStats, getFunnel, getDailySeries, byPlatform, byCountry, byLanguage, byCategory } from "@/lib/services/analytics";

export const GET = withAuth("analytics:read", async (_req, { user }) => {
  const [stats, funnel, series, platform, country, language, category] = await Promise.all([
    getDashboardStats(user.orgId), getFunnel(user.orgId), getDailySeries(user.orgId, 14), byPlatform(user.orgId), byCountry(user.orgId), byLanguage(user.orgId), byCategory(user.orgId),
  ]);
  return ok({ stats, funnel, series, breakdowns: { platform, country, language, category } });
});
