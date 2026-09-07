import type { Role } from "@prisma/client";

export type Permission =
  | "org:read"
  | "org:settings"
  | "org:members"
  | "job:read"
  | "job:discover"
  | "job:analyze"
  | "proposal:read"
  | "proposal:create"
  | "proposal:edit"
  | "proposal:approve"
  | "proposal:send"
  | "conversation:read"
  | "conversation:reply"
  | "conversation:approve"
  | "quote:create"
  | "quote:approve"
  | "deal:read"
  | "deal:approve"
  | "crm:read"
  | "crm:write"
  | "automation:read"
  | "automation:write"
  | "analytics:read"
  | "audit:read"
  | "costs:read"
  | "platform:manage";

const ALL: Permission[] = [
  "org:read", "org:settings", "org:members", "job:read", "job:discover", "job:analyze",
  "proposal:read", "proposal:create", "proposal:edit", "proposal:approve", "proposal:send",
  "conversation:read", "conversation:reply", "conversation:approve", "quote:create", "quote:approve",
  "deal:read", "deal:approve", "crm:read", "crm:write", "automation:read", "automation:write",
  "analytics:read", "audit:read", "costs:read", "platform:manage",
];

export const PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL,
  MANAGER: ALL.filter((p) => !["org:members", "platform:manage"].includes(p)),
  SALES: [
    "org:read", "job:read", "job:discover", "job:analyze", "proposal:read", "proposal:create", "proposal:edit",
    "proposal:send", "conversation:read", "conversation:reply", "quote:create", "deal:read", "crm:read", "crm:write",
    "automation:read", "analytics:read", "costs:read",
  ],
  VIEWER: ["org:read", "job:read", "proposal:read", "conversation:read", "deal:read", "crm:read", "automation:read", "analytics:read", "costs:read"],
};

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export const ROLE_RANK: Record<Role, number> = { VIEWER: 0, SALES: 1, MANAGER: 2, ADMIN: 3 };
