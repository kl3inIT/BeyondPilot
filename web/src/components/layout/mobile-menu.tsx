"use client";

import { ChevronRightIcon, MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { liveCampaignUrl, siteRoutes } from "@/lib/site";

/** Full-screen menu for narrow screens: live campaign first, then sections, then account actions. */
function MobileMenu() {
  const t = useTranslations("Site");
  const c = useTranslations("Campaign");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = [
    { href: siteRoutes.programs, label: t("nav.programs"), hint: t("menu.programsHint") },
    { href: siteRoutes.useCases, label: t("nav.useCases"), hint: t("menu.useCasesHint") },
    { href: siteRoutes.solutions, label: t("nav.solutions"), hint: t("menu.solutionsHint") },
    { href: siteRoutes.talent, label: t("nav.talent"), hint: t("menu.talentHint") },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<IconButton aria-label={t("menu.open")} className="md:hidden" />}>
        <MenuIcon aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-full">
        <div className="flex flex-1 flex-col">
          <SheetTitle className="sr-only">{t("menu.title")}</SheetTitle>
          <div className="flex h-16 items-center border-b px-4">
            <BrandLockup />
          </div>
          <a
            href={liveCampaignUrl}
            onClick={close}
            className="flex items-center gap-3 bg-muted/60 px-4 py-3 hover:bg-muted"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{c("shortName")}</span>
              <span className="text-xs text-muted-foreground">
                {c("liveNow")} · {c("closes")}
              </span>
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </a>
          <nav aria-label={t("nav.label")} className="flex flex-col px-4 py-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="flex items-center justify-between border-b py-4"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-lg font-semibold">{link.label}</span>
                  <span className="text-sm text-muted-foreground">{link.hint}</span>
                </span>
                <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t p-4">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href={siteRoutes.getStarted} onClick={close} />}
            >
              {t("nav.getStarted")}
            </Button>
            <Button
              size="lg"
              prominence="secondary"
              nativeButton={false}
              render={<Link href={siteRoutes.signIn} onClick={close} />}
            >
              {t("nav.signIn")}
            </Button>
            <Link
              href={siteRoutes.talentProfile}
              onClick={close}
              className="text-xs text-muted-foreground"
            >
              {t("menu.talentCta")}
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { MobileMenu };
