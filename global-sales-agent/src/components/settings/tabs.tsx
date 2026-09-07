"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/profile", label: "Company Profile" },
  { href: "/settings/platforms", label: "Platforms" },
  { href: "/settings/ai", label: "AI & Automation" },
  { href: "/settings/prompts", label: "Prompts" },
  { href: "/settings/team", label: "Team" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 overflow-x-auto" data-testid="settings-tabs">
      <div className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground">
        {SETTINGS_TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link key={t.href} href={t.href} data-testid={`settings-tab-${t.href.split("/").pop()}`} aria-current={active ? "page" : undefined} className={cn("inline-flex items-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all", active ? "bg-card text-foreground shadow-sm" : "hover:text-foreground")}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
