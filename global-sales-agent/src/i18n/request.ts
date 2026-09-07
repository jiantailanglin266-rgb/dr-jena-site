import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALES = ["ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale: Locale = raw === "en" ? "en" : "ja";
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
