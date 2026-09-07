"use client";
import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export function DropdownMenuContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={6} align="end" className={cn("z-50 min-w-[180px] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg", className)} {...props} />
    </DM.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Item>) {
  return <DM.Item className={cn("relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-muted", className)} {...props} />;
}
export const DropdownMenuSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
export const DropdownMenuLabel = ({ children }: { children: React.ReactNode }) => <DM.Label className="px-2 py-1 text-[11px] text-muted-foreground">{children}</DM.Label>;
