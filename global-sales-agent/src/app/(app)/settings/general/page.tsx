import { requireSession } from "@/lib/auth";
import { getOrgSettings, SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from "@/lib/settings";
import { PLAN_LIMITS, PLAN_LABELS } from "@/lib/plans";
import { GeneralForm } from "@/components/settings/general-form";

export default async function GeneralSettingsPage() {
  const user = await requireSession();
  const org = await getOrgSettings(user.orgId);
  const s = org.settings;
  return (
    <GeneralForm
      appName={org.appName}
      orgName={org.name}
      plan={org.plan}
      planLabel={PLAN_LABELS[org.plan]}
      planLimits={PLAN_LIMITS[org.plan]}
      languages={SUPPORTED_LANGUAGES}
      languageNames={LANGUAGE_NAMES}
      settings={{ defaultLanguage: s.defaultLanguage, targetCountries: s.targetCountries, targetCategories: s.targetCategories, targetLanguages: s.targetLanguages, excludeKeywords: s.excludeKeywords, businessHours: s.businessHours }}
    />
  );
}
