"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/**
 * Full-screen menu below 768px: one hint line per destination, then the ways in and the language.
 * A signed-in person has their account menu beside the menu button, so the ways in are left out.
 */
function MobileMenu({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("Site");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = [
    { href: siteRoutes.solutions, label: t("nav.solutions"), hint: t("menu.solutionsHint") },
    { href: siteRoutes.talent, label: t("nav.talent"), hint: t("menu.talentHint") },
    { href: siteRoutes.useCases, label: t("nav.useCases"), hint: t("menu.useCasesHint") },
    { href: siteRoutes.programs, label: t("nav.programs"), hint: t("menu.programsHint") },
    { href: siteRoutes.howItWorks, label: t("nav.howItWorks"), hint: t("menu.howItWorksHint") },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<IconButton aria-label={t("menu.open")} size="lg" className="md:hidden" />}
      >
        <MenuIcon aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-full"
      >
        <SheetTitle className="sr-only">{t("menu.title")}</SheetTitle>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex h-17 shrink-0 items-center justify-between border-b px-5">
            <BrandLockup showBackedBy={false} />
            <SheetClose render={<IconButton aria-label={t("menu.close")} size="lg" />}>
              <XIcon aria-hidden="true" />
            </SheetClose>
          </div>
          <nav aria-label={t("nav.label")} className="flex flex-col px-5 pt-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="flex flex-col gap-1 border-b py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="text-lg font-semibold">{link.label}</span>
                <span className="text-sm text-muted-foreground">{link.hint}</span>
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 px-5 pt-6 pb-8">
            {!signedIn && (
              <>
                <Button size="lg" prominence="inverse" href={siteRoutes.getStarted} onClick={close}>
                  {t("nav.getStarted")}
                </Button>
                <Button size="lg" prominence="secondary" href={siteRoutes.signIn} onClick={close}>
                  {t("nav.signIn")}
                </Button>
              </>
            )}
            <LanguageSwitcher className="text-sm" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { MobileMenu };
