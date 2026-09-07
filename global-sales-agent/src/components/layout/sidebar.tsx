"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Briefcase, FileText, KanbanSquare, MessagesSquare, Building2, Users, Handshake, ListChecks, Workflow, BarChart3, Coins, ScrollText, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "jobs", href: "/jobs", icon: Briefcase },
  { key: "proposals", href: "/proposals", icon: FileText },
  { key: "pipeline", href: "/pipeline", icon: KanbanSquare },
  { key: "conversations", href: "/conversations", icon: MessagesSquare },
] as const;
const CRM = [
  { key: "companies", href: "/crm/companies", icon: Building2 },
  { key: "contacts", href: "/crm/contacts", icon: Users },
  { key: "deals", href: "/crm/deals", icon: Handshake },
  { key: "tasks", href: "/crm/tasks", icon: ListChecks },
] as const;
const SYSTEM = [
  { key: "automation", href: "/automation", icon: Workflow },
  { key: "analytics", href: "/analytics", icon: BarChart3 },
  { key: "costs", href: "/costs", icon: Coins },
  { key: "audit", href: "/audit", icon: ScrollText },
  { key: "settings", href: "/settings/profile", icon: Settings, match: "/settings" },
] as const;

/** Navigation links shared by the desktop sidebar and the mobile drawer. */
export function NavLinks({ pending, onNavigate, testIdPrefix = "nav-" }: { pending: number; onNavigate?: () => void; testIdPrefix?: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const item = (n: { key: string; href: string; icon: React.ElementType; match?: string }) => {
    const base = n.match ?? n.href;
    const active = pathname === n.href || pathname.startsWith(base + "/") || pathname === base;
    const Icon = n.icon;
    return (
      <Link key={n.key} href={n.href} onClick={onNavigate} className={cn("group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors", active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground")} data-testid={`${testIdPrefix}${n.key}`}>
        <Icon className="size-4 shrink-0 opacity-80" />
        <span className="truncate">{t(n.key)}</span>
        {n.key === "conversations" && pending > 0 ? <span className="ml-auto rounded-full bg-warning-soft px-1.5 text-[10px] font-semibold text-warning">{pending}</span> : null}
      </Link>
    );
  };
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-3 scrollbar-thin">
      <div className="flex flex-col gap-0.5">{NAV.map(item)}</div>
      <div>
        <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("crm")}</p>
        <div className="flex flex-col gap-0.5">{CRM.map(item)}</div>
      </div>
      <div>
        <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">System</p>
        <div className="flex flex-col gap-0.5">{SYSTEM.map(item)}</div>
      </div>
    </nav>
  );
}

export function BrandMark({ appName }: { appName: string }) {
  return (
    <div className="flex h-14 items-center gap-2 px-4">
      <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-3.5" />
      </div>
      <span className="truncate text-[12px] font-semibold uppercase tracking-[0.16em]" data-testid="app-name">
        {appName}
      </span>
    </div>
  );
}

export function Sidebar({ appName, pending }: { appName: string; pending: number }) {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <BrandMark appName={appName} />
      <NavLinks pending={pending} />
      <div className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground">AI Sales Agent Platform · v0.1</div>
    </aside>
  );
}
