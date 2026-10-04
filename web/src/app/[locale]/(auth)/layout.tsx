import { useTranslations } from "next-intl";

import { BrandLockup } from "@/components/layout/brand-lockup";

/**
 * The frame of the sign-in screens: the brand and one narrow column. The site navigation is left
 * out on purpose, so nothing pulls a person away mid-way.
 */
export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = useTranslations("Site");

  return (
    <div className="relative flex flex-1 flex-col bg-background">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <header className="flex items-center px-5 py-5 md:px-8 lg:px-16">
        <BrandLockup showPoweredBy={false} />
      </header>
      <main
        id="content"
        className="flex flex-1 justify-center px-5 pt-8 pb-12 md:px-8 md:pt-22 md:pb-24"
      >
        <div className="flex w-full max-w-100 flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
