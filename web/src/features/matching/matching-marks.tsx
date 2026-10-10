import { CircleCheckIcon, CircleDotIcon, CircleHelpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

import { sourceOf, statuses, type NeedStatus } from "./matching-view";

/** The tone of a status; the words beside it carry the meaning. */
function StatusIcon({ status }: { status: NeedStatus }) {
  if (status === "met") {
    return <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />;
  }
  if (status === "partly") {
    return <CircleDotIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />;
  }
  return <CircleHelpIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
}

/** Whether a solution meets a requirement, as an icon and words: the words carry the meaning, the icon its tone. */
function StatusChip({ status }: { status: NeedStatus }) {
  const t = useTranslations("Matching.status");

  return (
    <span
      data-slot="matching-status"
      data-status={status}
      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium whitespace-nowrap"
    >
      <StatusIcon status={status} />
      {t(status)}
    </span>
  );
}

/**
 * What a solution shows over the capabilities a use case asks for, as one line: how many it meets,
 * meets in part and shows no evidence for, each with its icon and its words, a count of zero left out.
 * With one capability it is that one status in words.
 */
function StatusCounts({ counts }: { counts: Record<NeedStatus, number> }) {
  const t = useTranslations("Matching.row.counts");
  const counted = statuses.filter((status) => counts[status] > 0);
  const [only] = counted;

  if (counted.length === 1 && counts[only] === 1) {
    return <StatusChip status={only} />;
  }
  return (
    <span data-slot="matching-counts" className="text-sm font-medium">
      {counted.map((status, index) => (
        <Fragment key={status}>
          {index > 0 && <span className="text-muted-foreground"> · </span>}
          <span data-status={status} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <StatusIcon status={status} />
            {t(status, { count: counts[status] })}
          </span>
        </Fragment>
      ))}
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

export { StatusChip, StatusCounts, useSourceLine };
