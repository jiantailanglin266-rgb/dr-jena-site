import { requireSession } from "@/lib/auth";
import { listPlatformAccounts } from "@/lib/services/platforms";
import { getOrgSettings } from "@/lib/settings";
import { PLAN_LIMITS } from "@/lib/plans";
import { PlatformCard, type PlatformCardData } from "@/components/settings/platform-card";

export default async function PlatformsSettingsPage() {
  const user = await requireSession();
  const [rows, org] = await Promise.all([listPlatformAccounts(user.orgId), getOrgSettings(user.orgId)]);
  const configured = rows.filter((r) => r.account).length;
  const max = PLAN_LIMITS[org.plan].maxPlatformAccounts;

  const cards: PlatformCardData[] = rows.map((r) => ({
    key: r.platform.key,
    displayName: r.platform.displayName,
    website: r.platform.website,
    termsUrl: r.platform.termsUrl,
    officialApi: r.platform.officialApi,
    automatedSendingPolicy: r.platform.automatedSendingPolicy,
    defaultSendMode: r.platform.defaultSendMode,
    complianceNotes: r.platform.complianceNotes,
    supportedLanguages: r.platform.supportedLanguages,
    capabilities: r.connector.capabilities,
    credentialFields: r.connector.credentialFields,
    account: r.account
      ? { label: r.account.label, enabled: r.account.enabled, sendMode: r.account.sendMode, config: r.account.config, credentials: r.account.credentials, lastDiscoveryAt: r.account.lastDiscoveryAt?.toISOString() ?? null, lastReplyPollAt: r.account.lastReplyPollAt?.toISOString() ?? null }
      : null,
    limits: r.limits,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {configured}/{max} platform accounts configured on the {org.plan} plan. Platforms whose terms prohibit automated sending are locked to manual modes; the system never bypasses marketplace rules.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {cards.map((c) => (
          <PlatformCard key={c.key} p={c} />
        ))}
      </div>
    </div>
  );
}
