"use client";

import {
  BookmarkPlusIcon,
  CheckIcon,
  CircleDashedIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FileQuestionIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

import { StatusChip } from "./matching-marks";
import { rowVerdict, unreadOf, type Need } from "./matching-view";

type MatchingRowProps = {
  candidate: MatchingCandidate;
  needs: Need[];
  /** Whether the panel shows this solution now. */
  selected: boolean;
  /** True while a request about this solution is on its way. */
  pending: boolean;
  /** While a run works: whether the AI is reading this solution now, or it waits for its turn. */
  reading?: "now" | "waiting";
  /** Whether the row entered its group a moment ago: it comes in, and is marked for a moment. */
  arrived?: boolean;
  onSelect: () => void;
  /** Puts it on the shortlist, or takes it off when it is there. */
  onShortlist: () => void;
  /** Opens the reason picker in the place of the row. */
  onRemove: () => void;
};

/** Where a solution is from and how far along it is, as one quiet line. */
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
 * One solution in a group. Its logo, its name and the shortlist action share the first line at every
 * width; under them come what the group does not say already, the AI's sentence in two lines at most,
 * and where the solution is from. The vendor's own words are read in the panel, which the row opens.
 */
function MatchingRow({
  candidate,
  needs,
  selected,
  pending,
  reading,
  arrived = false,
  onSelect,
  onShortlist,
  onRemove,
}: MatchingRowProps) {
  const t = useTranslations("Matching.row");
  const meta = useCandidateMeta()(candidate);
  const verdict = rowVerdict(candidate, needs);
  const unread = candidate.judged ? unreadOf(candidate) : undefined;
  const summary = candidate.judged ? candidate.summary?.trim() : undefined;
  const shortlisted = candidate.decision === "shortlisted";

  return (
    <li
      data-selected={selected}
      data-reading={reading}
      className={cn(
        "relative flex items-start gap-3 rounded-xl border border-transparent p-3 hover:bg-muted/50 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5",
        // Opacity and a short slide only: the rows under it take their place at once.
        arrived &&
          "animate-in ease-entrance animation-duration-200 fade-in slide-in-from-top-2 motion-reduce:animate-none",
      )}
    >
      {arrived && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-out rounded-xl bg-primary/10 ease-out animation-duration-2000 fill-mode-forwards fade-out motion-reduce:hidden"
        />
      )}
      <SolutionLogo
        name={candidate.solutionName}
        fileId={candidate.logoFileId}
        size="card"
        className="size-9 rounded-lg text-xs"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={onSelect}
            className="min-w-0 flex-1 text-left text-sm font-semibold wrap-break-word outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {candidate.solutionName}
          </button>
          <div className="relative flex shrink-0 items-center gap-1">
            {/* On a phone the action keeps its place on the line as an icon; its name is the same. */}
            <Button
              prominence="secondary"
              size="sm"
              aria-pressed={shortlisted}
              pending={pending}
              onClick={onShortlist}
            >
              {!pending &&
                (shortlisted ? (
                  <CheckIcon aria-hidden="true" />
                ) : (
                  <BookmarkPlusIcon aria-hidden="true" className="sm:hidden" />
                ))}
              <span className="max-sm:sr-only">{t(shortlisted ? "shortlisted" : "shortlist")}</span>
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
              <DropdownMenuContent align="end" className="w-60">
                {candidate.listed && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        className="pointer-coarse:min-h-11"
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
                  <DropdownMenuItem
                    variant="destructive"
                    className="pointer-coarse:min-h-11"
                    onClick={onRemove}
                  >
                    <Trash2Icon aria-hidden="true" />
                    {t("remove")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {reading && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {reading === "now" ? (
              <Loader2Icon
                aria-hidden="true"
                className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              />
            ) : (
              <CircleDashedIcon aria-hidden="true" className="size-4 shrink-0" />
            )}
            {t(`reading.${reading}`)}
          </p>
        )}
        {(verdict || unread) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {verdict && <StatusChip status={verdict} />}
            {unread && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <FileQuestionIcon aria-hidden="true" className="size-4 shrink-0" />
                {t(`unread.${unread}`)}
              </span>
            )}
          </p>
        )}
        {summary && <p className="line-clamp-2 text-sm">{summary}</p>}
        {(meta || candidate.origin === "added") && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {meta}
            {candidate.origin === "added" && <Badge variant="secondary">{t("added")}</Badge>}
          </p>
        )}
      </div>
    </li>
  );
}

export { MatchingRow, useCandidateMeta };
