"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

const dayMs = 86_400_000;

// Days are counted once when the page opens; a visit rarely spans midnight.
const subscribe = () => () => {};

/**
 * "12 days left · closes 15 Oct, 23:59 ICT". The page is rendered ahead of time, so the server
 * states only the deadline and the browser adds the day count when it hydrates.
 */
function CampaignCountdown({ deadline }: { deadline: string }) {
  const t = useTranslations("Campaign");
  const daysLeft = useSyncExternalStore(
    subscribe,
    () => Math.floor((Date.parse(deadline) - Date.now()) / dayMs),
    () => null,
  );

  if (daysLeft === null) {
    return t("closes");
  }
  // Under a day past the deadline floors to -1, so any negative count means submissions closed.
  return daysLeft < 0 ? t("closed") : t("countdown", { days: daysLeft });
}

export { CampaignCountdown };
