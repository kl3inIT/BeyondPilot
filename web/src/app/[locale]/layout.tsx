import type { Metadata } from "next";
import { Geist_Mono, Lexend, Montserrat } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Analytics } from "@/components/layout/analytics";
import { Providers } from "@/components/layout/providers";
import { MessageScope } from "@/i18n/message-scope";
import { routing } from "@/i18n/routing";

import "../globals.css";

// The text of the whole site, and the headings above it: the pair the programs' own pages are drawn with.
const lexend = Lexend({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

const montserrat = Montserrat({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
  // Only charts and keyboard hints use it, never the first view, so it is not preloaded.
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${lexend.variable} ${montserrat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <MessageScope>
          <Providers>{children}</Providers>
          <Analytics />
        </MessageScope>
      </body>
    </html>
  );
}
