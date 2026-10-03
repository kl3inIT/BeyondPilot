import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/**
 * Brand and four destinations on the left, account actions on the right. The search is the
 * landing's primary action, so Get started stays secondary here (DESIGN.md › Buttons).
 */
function SiteHeader() {
  const t = useTranslations("Site.nav");
  const links = [
    { href: siteRoutes.programs, label: t("programs") },
    { href: siteRoutes.useCases, label: t("useCases") },
    { href: siteRoutes.solutions, label: t("solutions") },
    { href: siteRoutes.talent, label: t("talent") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex h-17 w-full max-w-360 items-center justify-between gap-6 px-5 md:px-8 xl:px-16">
        <div className="flex items-center gap-8">
          <BrandLockup showPoweredBy={false} />
          <nav aria-label={t("label")} className="hidden items-center gap-7 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hit-area rounded-sm text-sm font-medium transition-colors outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button prominence="tertiary" className="hidden md:inline-flex" href={siteRoutes.signIn}>
            {t("signIn")}
          </Button>
          <Button prominence="secondary" href={siteRoutes.getStarted}>
            {t("getStarted")}
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export { SiteHeader };
