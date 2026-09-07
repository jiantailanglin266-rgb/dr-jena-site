import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GLOBAL SALES AGENT", template: "%s · GLOBAL SALES AGENT" },
  description: "Multilingual AI Sales & Deal Automation Platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Static theme bootstrap (no user data) — avoids a flash of light theme for dark-mode users */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}" }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
