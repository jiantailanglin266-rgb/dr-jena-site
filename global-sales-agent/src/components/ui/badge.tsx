import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-muted text-foreground",
      outline: "border-border text-foreground",
      success: "border-transparent bg-success-soft text-success",
      warning: "border-transparent bg-warning-soft text-warning",
      danger: "border-transparent bg-danger-soft text-danger",
      info: "border-transparent bg-info-soft text-info",
      accent: "border-transparent bg-accent-soft text-accent",
    },
  },
  defaultVariants: { variant: "secondary" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  NEW: "secondary", ANALYZED: "info", QUALIFIED: "success", EXCLUDED: "danger", ARCHIVED: "outline",
  DRAFT: "secondary", AI_REVIEWED: "warning", WAITING_APPROVAL: "warning", APPROVED: "info", SCHEDULED: "info", SENT: "success", FAILED: "danger", REPLIED: "accent", CLOSED: "outline",
  DISCOVERED: "secondary", PROPOSAL_CREATED: "info", PROPOSAL_SENT: "info", NEGOTIATING: "warning", MEETING_REQUESTED: "accent", QUOTE_SENT: "accent", FINAL_NEGOTIATION: "warning", VERBAL_ACCEPT: "success", WON: "success", LOST: "danger",
  INTERESTED: "success", QUESTION: "info", PRICE_NEGOTIATION: "warning", SCHEDULE_NEGOTIATION: "warning", TECHNICAL_QUESTION: "info", REQUEST_PORTFOLIO: "info", REQUEST_MEETING: "accent", OBJECTION: "warning", REJECTION: "danger", ACCEPTANCE: "success", UNKNOWN: "secondary",
  PENDING: "warning", NOT_REQUIRED: "outline", REJECTED: "danger",
  SUMMARY_DRAFT: "secondary", WAITING_HUMAN_APPROVAL: "warning",
  AUTO: "success", MANUAL_APPROVAL: "warning", MANUAL_ONLY: "outline",
  ALLOWED: "success", RESTRICTED: "warning", PROHIBITED: "danger",
  OPEN: "warning", DONE: "success", CANCELLED: "outline",
  POSITIVE: "success", NEUTRAL: "secondary", NEGATIVE: "danger",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className={className}>{status.replace(/_/g, " ")}</Badge>;
}
