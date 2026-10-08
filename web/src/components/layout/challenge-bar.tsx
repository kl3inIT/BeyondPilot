"use client";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { usePathname } from "@/i18n/navigation";
import { liveCampaignDeadline, liveCampaignUrl, siteRoutes } from "@/lib/site";

// The deadline is read once when the page opens; a visit rarely spans it.
const subscribe = () => () => {};

/**
 * The live challenge across the top of the landing (Figma "Landing v2 / ChallengeBar"): its name,
 * when submissions close and the way in. It shows on the home page only and goes once the deadline
 * has passed; the page is rendered ahead of time, so the browser decides that when it hydrates.
 */
function ChallengeBar() {
  const t = useTranslations("Campaign");
  const pathname = usePathname();
  const closed = useSyncExternalStore(
    subscribe,
    () => Date.now() > Date.parse(liveCampaignDeadline),
    () => false,
  );

  if (pathname !== siteRoutes.home || closed) {
    return null;
  }

  return (
    <a
      href={liveCampaignUrl}
      className="group flex min-h-11 items-center justify-center gap-x-3 gap-y-1 bg-foreground px-5 py-2 text-sm text-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:px-8"
    >
      <Badge variant="success">{t("live")}</Badge>
      <span className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-3">
        <span className="font-medium">{t("name")}</span>
        <span aria-hidden="true" className="hidden text-background/60 md:inline">
          ·
        </span>
        <span className="text-xs text-background/75 md:text-sm">{t("submissionsClose")}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-semibold">
        {t("apply")}
        <ArrowRightIcon
          className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </a>
  );
}

export { ChallengeBar };
