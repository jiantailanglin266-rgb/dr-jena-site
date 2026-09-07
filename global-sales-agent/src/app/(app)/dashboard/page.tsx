import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { getDashboardStats, getFunnel, getDailySeries, byPlatform, byCountry, byLanguage, byCategory } from "@/lib/services/analytics";
import { listActivities, listTasks } from "@/lib/services/crm";
import { PageHeader, StatCard, Flag } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendChart, FunnelChart, BarBreakdown } from "@/components/charts";
import { DashboardActions } from "./actions";
import { formatCurrency, formatPct, timeAgo } from "@/lib/utils";
import { Briefcase, FileText, MessagesSquare, Handshake, TrendingUp, Wallet, Percent, Coins } from "lucide-react";
import { LANGUAGE_NAMES } from "@/lib/settings";

export default async function DashboardPage() {
  const user = await requireSession();
  const t = await getTranslations("dashboard");
  const [stats, funnel, series, platform, country, language, category, activities, tasks] = await Promise.all([
    getDashboardStats(user.orgId),
    getFunnel(user.orgId),
    getDailySeries(user.orgId, 14),
    byPlatform(user.orgId),
    byCountry(user.orgId),
    byLanguage(user.orgId),
    byCategory(user.orgId),
    listActivities(user.orgId, undefined, 8),
    listTasks(user.orgId, "OPEN"),
  ]);
  const pending = stats.pendingApprovals;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} actions={<DashboardActions labels={{ discover: t("runDiscovery"), sync: t("syncReplies") }} />} />

      {pending.proposals + pending.messages + pending.deals + pending.quotes > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-xs" data-testid="pending-banner">
          <span className="font-medium text-warning">{t("pendingApprovals")}:</span>
          {pending.proposals ? <Link href="/proposals?status=WAITING_APPROVAL" className="underline-offset-2 hover:underline">Proposals {pending.proposals}</Link> : null}
          {pending.messages ? <Link href="/conversations?pending=1" className="underline-offset-2 hover:underline">Replies {pending.messages}</Link> : null}
          {pending.quotes ? <Link href="/conversations?pending=1" className="underline-offset-2 hover:underline">Quotes {pending.quotes}</Link> : null}
          {pending.deals ? <Link href="/crm/deals" className="underline-offset-2 hover:underline">Deals {pending.deals}</Link> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t("jobsDiscovered")} value={stats.jobsDiscovered} hint={`${stats.jobsQualified} qualified`} icon={<Briefcase />} />
        <StatCard label={t("proposalsToday")} value={stats.proposalsToday} hint={`${stats.proposalsSent} sent total`} icon={<FileText />} />
        <StatCard label={t("replies")} value={stats.replies} hint={`${t("replyRate")} ${formatPct(stats.replyRate)}`} icon={<MessagesSquare />} />
        <StatCard label={t("negotiations")} value={stats.negotiations} hint={`${stats.meetings} meetings`} icon={<TrendingUp />} />
        <StatCard label={t("won")} value={stats.won} hint={`${t("winRate")} ${formatPct(stats.winRate)}`} icon={<Handshake />} />
        <StatCard label={t("pipelineValue")} value={formatCurrency(stats.pipelineValueUsd, "USD")} icon={<Wallet />} />
        <StatCard label={t("confirmedRevenue")} value={formatCurrency(stats.confirmedRevenueUsd, "USD")} icon={<Coins />} />
        <StatCard label={t("avgDeal")} value={formatCurrency(stats.avgDealSizeUsd, "USD")} icon={<Percent />} />
        <StatCard label={t("replyRate")} value={formatPct(stats.replyRate)} />
        <StatCard label={t("winRate")} value={formatPct(stats.winRate)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("daily")}</CardTitle>
            <CardDescription>Discovered · Sent · Replies · Won (14 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={series}
              series={[
                { key: "discovered", label: "Discovered", color: "#a1a1aa" },
                { key: "sent", label: "Sent", color: "#6366f1" },
                { key: "replies", label: "Replies", color: "#14b8a6" },
                { key: "won", label: "Won", color: "#22c55e" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("funnel")}</CardTitle>
            <CardDescription>Conversion between stages</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelChart stages={funnel} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("byPlatform")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarBreakdown data={platform.slice(0, 6)} xKey="key" valueKey="jobs" height={160} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("byCountry")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-xs">
              {country.slice(0, 8).map((r) => (
                <li key={r.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Flag country={r.key} /> {r.key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.jobs} jobs · {r.proposals} sent · {r.won} won
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("byLanguage")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-xs">
              {language.slice(0, 8).map((r) => (
                <li key={r.key} className="flex items-center justify-between">
                  <span>{LANGUAGE_NAMES[r.key] ?? r.key}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.jobs} · reply {formatPct(r.replyRate, 0)} · win {formatPct(r.winRate, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("byCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarBreakdown data={category.slice(0, 8)} xKey="key" valueKey="jobs" height={160} color="#6366f1" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {activities.length === 0 ? <li className="py-3 text-xs text-muted-foreground">No activity yet — run discovery.</li> : null}
              {activities.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant={a.actorType === "AI" ? "accent" : a.actorType === "USER" ? "info" : "secondary"}>{a.actorType}</Badge>
                    <span className="truncate">{a.title}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open tasks</CardTitle>
            <CardDescription>Human-in-the-loop items</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {tasks.length === 0 ? <li className="py-3 text-xs text-muted-foreground">No open tasks.</li> : null}
              {tasks.slice(0, 8).map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <Link href={task.opportunity?.deal ? `/crm/deals/${task.opportunity.deal.id}` : "/crm/tasks"} className="truncate hover:underline">
                    {task.title}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">{timeAgo(task.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
