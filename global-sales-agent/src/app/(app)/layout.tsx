import { requireSession } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { getLocale } from "next-intl/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const [org, locale, pendingProposals, pendingMessages, pendingDeals] = await Promise.all([
    getOrgSettings(user.orgId),
    getLocale(),
    prisma.proposal.count({ where: { organizationId: user.orgId, status: "WAITING_APPROVAL" } }),
    prisma.message.count({ where: { organizationId: user.orgId, approvalStatus: "PENDING" } }),
    prisma.deal.count({ where: { organizationId: user.orgId, status: "WAITING_HUMAN_APPROVAL" } }),
  ]);
  return (
    <div className="flex min-h-screen">
      <Sidebar appName={org.appName} pending={pendingMessages} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={{ name: user.name, email: user.email, role: user.role }} org={{ name: org.name, plan: org.plan }} locale={locale} pending={{ proposals: pendingProposals, messages: pendingMessages, deals: pendingDeals }} demo={isDemoMode()} appName={org.appName} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px] fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
