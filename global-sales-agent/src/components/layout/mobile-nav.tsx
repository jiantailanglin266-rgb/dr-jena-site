"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./sidebar";

/** Hamburger + slide-in drawer for viewports below `lg` (desktop shows the fixed sidebar). */
export function MobileNav({ appName, pending }: { appName: string; pending: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    // close on navigation without a synchronous setState in the effect body
    const id = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)} data-testid="mobile-nav-open">
        <Menu className="size-4" />
      </Button>
      {open
        ? createPortal(
        // Portal to <body>: the header's backdrop-blur would otherwise become the containing block for `fixed`
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[260px] flex-col border-r border-border shadow-xl fade-in" style={{ background: "var(--card)" }}>
            <div className="flex h-14 items-center justify-between px-4">
              <span className="truncate text-[12px] font-semibold uppercase tracking-[0.16em]">{appName}</span>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <NavLinks pending={pending} onNavigate={() => setOpen(false)} testIdPrefix="mnav-" />
          </aside>
        </div>,
        document.body,
      )
        : null}
    </div>
  );
}
