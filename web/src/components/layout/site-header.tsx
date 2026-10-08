import { useTranslations } from "next-intl";

import { BrandLockup } from "@/components/layout/brand-lockup";
import { HeaderAccount } from "@/components/layout/header-account";
import { LanguageMenu } from "@/components/layout/language-menu";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/**
 * Brand and five destinations on the left, account actions on the right. A destination turns azure
 * under the pointer.
 */
function SiteHeader() {
  const t = useTranslations("Site.nav");
  const links = [
    { href: siteRoutes.solutions, label: t("solutions") },
    { href: siteRoutes.talent, label: t("talent") },
    { href: siteRoutes.useCases, label: t("useCases") },
    { href: siteRoutes.programs, label: t("programs") },
    { href: siteRoutes.howItWorks, label: t("howItWorks") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex h-17 w-full max-w-360 items-center justify-between gap-6 px-5 md:px-8 xl:px-16 desktop:px-20">
        <div className="flex items-center gap-8">
          <BrandLockup showBackedBy={false} />
          <nav aria-label={t("label")} className="hidden items-center gap-7 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hit-area rounded-sm text-sm font-nav transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}

export { SiteHeader };
