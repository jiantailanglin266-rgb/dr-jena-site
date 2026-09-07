import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PLAN_LIMITS } from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TeamTable, AddMemberButton, type Member } from "@/components/settings/team";

export default async function TeamSettingsPage() {
  const user = await requireSession();
  const [memberships, org] = await Promise.all([
    prisma.membership.findMany({ where: { organizationId: user.orgId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { plan: true } }),
  ]);
  const members: Member[] = memberships.map((m) => ({ id: m.id, userId: m.userId, role: m.role, createdAt: m.createdAt.toISOString(), name: m.user.name, email: m.user.email }));
  const max = PLAN_LIMITS[org.plan].maxUsers;
  const canManage = hasPermission(user.role, "org:members");
  const atLimit = members.length >= max;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {members.length}/{max} members on the {org.plan} plan. Roles control approvals, settings and credentials.
          </CardDescription>
        </div>
        {canManage ? <AddMemberButton disabled={atLimit} hint={atLimit ? `Plan limit reached (${max} users)` : undefined} /> : null}
      </CardHeader>
      <CardContent>
        <TeamTable members={members} currentUserId={user.id} canManage={canManage} />
      </CardContent>
    </Card>
  );
}
