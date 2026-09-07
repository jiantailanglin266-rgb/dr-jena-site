import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const t = await getTranslations("login");
  const org = await prisma.organization.findFirst({ select: { appName: true } }).catch(() => null);
  const appName = org?.appName ?? "GLOBAL SALES AGENT";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold">G</div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{appName}</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm labels={{ email: t("email"), password: t("password"), submit: t("submit"), demoHint: t("demoHint"), error: t("error") }} demo={process.env.DEMO_MODE === "true"} />
      </div>
    </main>
  );
}
