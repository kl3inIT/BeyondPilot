"use client";

import { CheckIcon, EllipsisIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SolutionLogo } from "@/features/solution/solution-logo";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { MatchingCandidate } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { NeedDots, SourceChip } from "./matching-marks";
import { bestQuote, type Need } from "./matching-view";

type MatchingRowProps = {
  candidate: MatchingCandidate;
  needs: Need[];
  /** Whether the panel beside the list shows this candidate. */
  selected: boolean;
  /** True while a request about this candidate is on its way. */
  pending: boolean;
  onSelect: () => void;
  /** Puts it on the shortlist, or takes it off when it is there. */
  onShortlist: () => void;
  /** Opens the reason picker in the place of the row. */
  onRemove: () => void;
};

/** Where and how far a solution is, as the line beside its name. */
function useCandidateMeta() {
  const countryName = useCountryName();
  const maturityName = useVocabulary("maturity");
  return (candidate: Pick<MatchingCandidate, "country" | "maturity">) =>
    [
      candidate.country && countryName(candidate.country),
      candidate.maturity && maturityName(candidate.maturity),
    ]
      .filter(Boolean)
      .join(" · ");
}

/**
 * One candidate in a group: its logo and name, a mark per need, where it is and how far, and the best
 * words of its own material. Choosing the row opens it in the panel; the actions stay on the row.
 */
function MatchingRow({
  candidate,
  needs,
  selected,
  pending,
  onSelect,
  onShortlist,
  onRemove,
}: MatchingRowProps) {
  const t = useTranslations("Matching.row");
  const meta = useCandidateMeta()(candidate);
  const quote = bestQuote(candidate, needs);
  const shortlisted = candidate.decision === "shortlisted";

  return (
    <li
      data-selected={selected}
      className="relative flex flex-col gap-3 rounded-xl border border-transparent p-3 hover:bg-muted/50 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <SolutionLogo
          name={candidate.solutionName}
          fileId={candidate.logoFileId}
          size="card"
          className="size-9 rounded-lg text-xs"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={onSelect}
              className="text-left text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {candidate.solutionName}
            </button>
            {candidate.judged && <NeedDots needs={needs} candidate={candidate} />}
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
            {candidate.origin === "added" && <Badge variant="secondary">{t("added")}</Badge>}
          </div>
          {quote ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <q className="text-sm text-muted-foreground">{quote.quote}</q>
              <SourceChip source={quote.source} />
            </div>
          ) : (
            !candidate.judged && <p className="text-sm text-muted-foreground">{t("waiting")}</p>
          )}
        </div>
      </div>
      <div className="relative flex shrink-0 items-center gap-1 self-end sm:self-center">
        <Button
          prominence="secondary"
          size="sm"
          aria-pressed={shortlisted}
          pending={pending}
          onClick={onShortlist}
        >
          {shortlisted && !pending && <CheckIcon aria-hidden="true" />}
          {t(shortlisted ? "shortlisted" : "shortlist")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <IconButton
                prominence="tertiary"
                size="sm"
                aria-label={t("menu", { name: candidate.solutionName })}
              />
            }
          >
            <EllipsisIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {candidate.listed && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link href={`${siteRoutes.solutions}/${candidate.solutionSlug}`} />}
                  >
                    <ExternalLinkIcon aria-hidden="true" />
                    {t("open")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={onRemove}>
                <Trash2Icon aria-hidden="true" />
                {t("remove")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export { MatchingRow, useCandidateMeta };
