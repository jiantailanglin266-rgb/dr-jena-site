"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Bell, ChevronDown, Globe, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { useEffect, useState } from "react";

export function Topbar({ user, org, locale, pending, demo }: { user: { name: string; email: string; role: string }; org: { name: string; plan: string }; locale: string; pending: { proposals: number; messages: number; deals: number }; demo: boolean }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    const raf = requestAnimationFrame(sync);
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, []);
  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }
  function setLocale(l: string) {
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  const total = pending.proposals + pending.messages + pending.deals;
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-card/70 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-medium">{org.name}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{org.plan}</span>
        {demo ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">DEMO MODE</span> : null}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" asChild title={t("approvals")}>
          <Link href="/proposals?status=WAITING_APPROVAL" data-testid="topbar-approvals">
            <span className="relative">
              <Bell className="size-4" />
              {total > 0 ? <span className="absolute -right-1.5 -top-1.5 rounded-full bg-warning px-1 text-[9px] font-semibold text-white">{total}</span> : null}
            </span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Theme">
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Globe className="size-4" />
              {locale.toUpperCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setLocale("ja")}>日本語</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLocale("en")}>English</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2" data-testid="user-menu">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{user.name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden sm:inline">{user.name}</span>
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              {user.email} · {user.role}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="size-3.5" />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
