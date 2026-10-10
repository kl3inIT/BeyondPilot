import {
  BriefcaseBusinessIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleHelpIcon,
  FileTextIcon,
  GlobeIcon,
  IdCardIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

import type { MatchingFinding } from "@/lib/api/generated";

import { chipOf, sourceOf, statuses, type NeedStatus } from "./matching-view";

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

/**
 * Where a vendor's words come from, as a line of text; a source this screen cannot name gives nothing.
 * With `found`, the line says the words are in that source: code found them there word for word. It
 * says where the words stand, never that what they claim is true.
 */
function useSourceLine() {
  const t = useTranslations("Matching.source");

  return (source: string, found = false) => {
    const at = sourceOf(source);
    if (!at) {
      return undefined;
    }
    if (at.kind === "customerCase") {
      return t(found ? "found.customerCase" : "customerCase", { number: at.number });
    }
    if (at.kind === "deck") {
      return t(found ? "found.deck" : "deck", { page: at.page });
    }
    return t(found ? `found.${at.kind}` : at.kind);
  };
}

const chipIcons = {
  website: GlobeIcon,
  deck: FileTextIcon,
  profile: IdCardIcon,
  customerCase: BriefcaseBusinessIcon,
} as const;

/**
 * Where the words on a row come from, in a few characters: an icon and the host of a web page, the page
 * of a deck, the profile or the customer case. It is read, not pressed: the row opens the panel.
 */
function SourceChip({ finding }: { finding: Pick<MatchingFinding, "source" | "sourceUrl"> }) {
  const t = useTranslations("Matching.row.source");
  const chip = chipOf(finding);
  if (!chip) {
    return null;
  }
  const Icon = chipIcons[chip.kind];
  const text =
    chip.kind === "website"
      ? (chip.host ?? t("website"))
      : chip.kind === "deck"
        ? t("deck", { page: chip.page })
        : chip.kind === "customerCase"
          ? t("customerCase", { number: chip.number })
          : t("profile");

  return (
    <span
      data-slot="matching-source"
      className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

export { SourceChip, StatusChip, StatusCounts, useSourceLine };
