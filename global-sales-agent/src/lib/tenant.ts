import { getSessionUser, type SessionUser } from "./auth";
import { hasPermission, type Permission } from "./rbac";

export class AuthError extends Error {
  status: number;
  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
}

/** Resolve tenant + actor for API routes. Throws AuthError (401/403). */
export async function requireOrg(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Unauthorized", 401);
  if (permission && !hasPermission(user.role, permission)) throw new AuthError(`Forbidden: missing ${permission}`, 403);
  return user;
}
