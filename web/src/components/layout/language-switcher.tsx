"use client";

import { cn } from "cn";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** "English · Tiếng Việt": the current page in the other language, the active one in ink. */
function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Site.language");
  const active = useLocale();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className={cn("flex items-center gap-1.5 font-medium text-muted-foreground", className)}
    >
      {routing.locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true">·</span>}
          <Link
            href={pathname}
            locale={locale}
            lang={locale}
            hrefLang={locale}
            aria-current={locale === active ? "true" : undefined}
            className="hit-area rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:text-foreground"
          >
            {t(locale)}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export { LanguageSwitcher };
