import { useTranslations } from "next-intl";

import { BrandLockup } from "@/components/layout/brand-lockup";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";
import { genaiFundLinks, siteRoutes } from "@/lib/site";

type FooterLink = { href: string; label: string; external?: boolean };

// On touch screens each link row grows to 44px instead of the 14px gaps between rows.
const linkClass =
  "flex w-fit items-center rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11";
// The legal links sit in the small print beside the copyright, with the same focus ring and touch target.
const legalLinkClass =
  "flex w-fit items-center rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11";

function SiteFooter() {
  const t = useTranslations("Site");
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: t("footer.platform"),
      links: [
        { href: siteRoutes.programs, label: t("nav.programs") },
        { href: siteRoutes.useCases, label: t("nav.useCases") },
        { href: siteRoutes.solutions, label: t("nav.solutions") },
        { href: siteRoutes.talent, label: t("nav.talent") },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { href: genaiFundLinks.about, label: t("footer.about"), external: true },
        { href: genaiFundLinks.events, label: t("footer.events"), external: true },
        { href: genaiFundLinks.newsletter, label: t("footer.newsletter"), external: true },
      ],
    },
    {
      title: t("footer.contact"),
      links: [
        { href: genaiFundLinks.linkedin, label: t("footer.linkedin"), external: true },
        { href: genaiFundLinks.facebook, label: t("footer.facebook"), external: true },
        { href: genaiFundLinks.x, label: t("footer.x"), external: true },
        { href: `mailto:${genaiFundLinks.email}`, label: genaiFundLinks.email, external: true },
      ],
    },
  ];

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-360 flex-col gap-10 px-5 pt-12 pb-8 md:gap-12 md:px-8 md:pt-16 xl:px-16">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="md:w-75">
            <BrandLockup />
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-8 md:flex-nowrap md:gap-x-24">
            {columns.map((column) => (
              <div key={column.title} className="flex flex-col gap-3.5 pointer-coarse:gap-1">
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <ul className="flex flex-col gap-3.5 pointer-coarse:gap-0">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          className={linkClass}
                          {...(link.href.startsWith("http")
                            ? { target: "_blank", rel: "noreferrer" }
                            : {})}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className={linkClass}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
            <Link href={siteRoutes.privacy} className={legalLinkClass}>
              {t("footer.privacy")}
            </Link>
            <Link href={siteRoutes.terms} className={legalLinkClass}>
              {t("footer.terms")}
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
