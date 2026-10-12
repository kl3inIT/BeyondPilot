"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { saveConsent } from "@/lib/analytics-consent";
import { siteRoutes } from "@/lib/site";

/**
 * Asks once whether Google Analytics may measure the visit. It stays along the bottom of the
 * window, over the page, until the visitor answers; nothing is measured before they accept.
 */
function CookieConsent() {
  const t = useTranslations("Site.cookies");

  return (
    <section
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg"
    >
      <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-8 md:px-8 xl:px-16 desktop:px-20">
        <p className="text-sm text-muted-foreground">
          {t.rich("message", {
            privacy: (chunks) => (
              <TextButton href={siteRoutes.privacy} className="whitespace-normal">
                {chunks}
              </TextButton>
            ),
          })}
        </p>
        <div className="flex shrink-0 gap-3">
          <Button
            prominence="secondary"
            className="flex-1 md:flex-none"
            onClick={() => saveConsent("denied")}
          >
            {t("decline")}
          </Button>
          <Button className="flex-1 md:flex-none" onClick={() => saveConsent("granted")}>
            {t("accept")}
          </Button>
        </div>
      </div>
    </section>
  );
}

export { CookieConsent };
