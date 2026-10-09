import { CircleCheckIcon, CircleDotIcon, CircleHelpIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { MatchingCandidate } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

import { sourceOf, statusOf, type Need, type NeedStatus } from "./matching-view";

/** Whether a requirement is met, as an icon and a word: the word carries the meaning, the icon its tone. */
function StatusChip({ status }: { status: NeedStatus }) {
  const t = useTranslations("Matching.status");

  return (
    <span
      data-slot="matching-status"
      data-status={status}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap"
    >
      {status === "met" && <CircleCheckIcon aria-hidden="true" className="size-3.5 text-success" />}
      {status === "partly" && (
        <CircleDotIcon aria-hidden="true" className="size-3.5 text-warning" />
      )}
      {status === "not_shown" && (
        <CircleHelpIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      )}
      {t(status)}
    </span>
  );
}

/** Where a quote stands in the solution's material, as text; a source this screen cannot name draws nothing. */
function SourceChip({ source }: { source: string }) {
  const t = useTranslations("Matching.source");
  const found = sourceOf(source);
  if (!found) {
    return null;
  }

  return (
    <Badge variant="outline">
      {found.kind === "customerCase"
        ? t("customerCase", { number: found.number })
        : found.kind === "deck"
          ? t("deck", { page: found.page })
          : t(found.kind)}
    </Badge>
  );
}

type NeedDotsProps = {
  needs: Need[];
  candidate: Pick<MatchingCandidate, "findings">;
};

/**
 * One mark per need beside a candidate's name: a full bar for a need it meets, a short one for a need
 * it comes near, an empty one for a need nothing shows. The same is said in words to a screen reader.
 */
function NeedDots({ needs, candidate }: NeedDotsProps) {
  const t = useTranslations("Matching");
  if (needs.length === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">
        {needs
          .map((need) =>
            t("row.need", {
              need: need.name,
              status: t(`status.${statusOf(candidate, need.position)}`),
            }),
          )
          .join(". ")}
      </span>
      {needs.map((need) => {
        const status = statusOf(candidate, need.position);
        return (
          <span
            key={need.position}
            aria-hidden="true"
            data-status={status}
            className="flex h-1.5 w-4 overflow-hidden rounded-full border border-border bg-background"
          >
            <span
              className={cn(
                "h-full rounded-full",
                status === "met" && "w-full bg-success",
                status === "partly" && "w-1/2 bg-warning",
              )}
            />
          </span>
        );
      })}
    </span>
  );
}

export { NeedDots, SourceChip, StatusChip };
