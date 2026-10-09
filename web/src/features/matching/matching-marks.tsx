import { CircleCheckIcon, CircleDotIcon, CircleHelpIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { sourceOf, type NeedStatus } from "./matching-view";

/** Whether a solution shows a thing asked for, as an icon and words: the words carry the meaning, the icon its tone. */
function StatusChip({ status }: { status: NeedStatus }) {
  const t = useTranslations("Matching.status");

  return (
    <span
      data-slot="matching-status"
      data-status={status}
      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium whitespace-nowrap"
    >
      {status === "met" && <CircleCheckIcon aria-hidden="true" className="size-4 text-success" />}
      {status === "partly" && <CircleDotIcon aria-hidden="true" className="size-4 text-warning" />}
      {status === "not_shown" && (
        <CircleHelpIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      )}
      {t(status)}
    </span>
  );
}

/** Where a vendor's words come from, as a line of text; a source this screen cannot name gives nothing. */
function useSourceLine() {
  const t = useTranslations("Matching.source");

  return (source: string) => {
    const found = sourceOf(source);
    if (!found) {
      return undefined;
    }
    return found.kind === "customerCase"
      ? t("customerCase", { number: found.number })
      : found.kind === "deck"
        ? t("deck", { page: found.page })
        : t(found.kind);
  };
}

export { StatusChip, useSourceLine };
