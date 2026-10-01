import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

function SiteHeader() {
  const t = useTranslations("Site.nav");
  const links = [
    { href: siteRoutes.programs, label: t("programs") },
    { href: siteRoutes.useCases, label: t("useCases") },
    { href: siteRoutes.solutions, label: t("solutions") },
    { href: siteRoutes.talent, label: t("talent") },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-17 max-w-328 items-center justify-between gap-6 px-4 sm:px-8">
        <div className="flex items-center gap-4">
          <div className="hidden lg:block">
            <BrandLockup />
          </div>
          <div className="lg:hidden">
            <BrandLockup showPoweredBy={false} />
          </div>
          <nav aria-label={t("label")} className="hidden items-center md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            prominence="tertiary"
            className="hidden md:inline-flex"
            nativeButton={false}
            render={<Link href={siteRoutes.signIn} />}
          >
            {t("signIn")}
          </Button>
          <Button
            className="hidden md:inline-flex"
            nativeButton={false}
            render={<Link href={siteRoutes.getStarted} />}
          >
            {t("getStarted")}
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export { SiteHeader };
