import { useTranslations } from "next-intl";

import { BrandLockup } from "@/components/layout/brand-lockup";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";
import { genaiFundLinks, siteRoutes } from "@/lib/site";

type FooterLink = { href: string; label: string; external?: boolean };

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
    <footer>
      <div className="mx-auto flex max-w-328 flex-col gap-4 p-4 sm:p-8">
        <div className="flex flex-col gap-10 border-b pt-12 pb-16 lg:flex-row lg:gap-4 lg:pb-24">
          <div className="lg:flex-1">
            <BrandLockup />
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:flex-3 lg:gap-4">
            {columns.map((column) => (
              <div key={column.title} className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <ul className="flex flex-col gap-4 text-sm">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground"
                          {...(link.href.startsWith("http")
                            ? { target: "_blank", rel: "noreferrer" }
                            : {})}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
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
        <div className="flex flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-4">
            <Link href={siteRoutes.privacy} className="hover:text-foreground">
              {t("footer.privacy")}
            </Link>
            <Link href={siteRoutes.terms} className="hover:text-foreground">
              {t("footer.terms")}
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
