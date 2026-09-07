import { PageHeader } from "@/components/ui/misc";
import { SettingsTabs } from "@/components/settings/tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Organisation, company profile, platform connections, AI behaviour, prompts and team." />
      <SettingsTabs />
      {children}
    </>
  );
}
