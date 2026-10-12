import { useTranslations } from "next-intl";

import { Status } from "@/components/composites/status";

/**
 * Whether an offer is open to new solutions or closed to them. A closed offer stays on the solutions
 * that come with it, so the word says only who may still choose it.
 */
function OfferState({ closed }: { closed: boolean }) {
  const t = useTranslations("Solution.offers.state");

  return (
    <Status tone={closed ? "neutral" : "success"} appearance="pill">
      {closed ? t("closed") : t("open")}
    </Status>
  );
}

export { OfferState };
