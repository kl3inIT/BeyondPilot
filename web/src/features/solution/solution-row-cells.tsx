import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { reviewState } from "@/components/composites/review-status";
import { Status } from "@/components/composites/status";
import { useVocabulary } from "@/i18n/vocabulary";
import type { SolutionSummary } from "@/lib/api/generated";

import { reviewFields } from "./solution-editor-state";

/** The tone of each state of a review in the list, where the states are scanned as pills. */
const reviewTones = {
  draft: "neutral",
  in_review: "info",
  needs_changes: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
} as const;

/** Whether anyone outside the organization reads a solution, and how they come to it. */
function listingOf(solution: SolutionSummary) {
  if (solution.status === "approved") {
    if (solution.suspendedAt) {
      return "takenDown";
    }
    return solution.listed ? "listed" : "unlisted";
  }
  return solution.status === "in_review" ? "notYet" : "notPublic";
}

/** The line under a solution's name: what it does, or what its owners do next. */
function useSolutionAbout() {
  const t = useTranslations("Solution.mine");
  const reason = useVocabulary("solutionRejection");
  const takedown = useVocabulary("solutionTakedown");

  return function about(solution: SolutionSummary) {
    if (solution.status === "draft") {
      return t("about.draft", {
        filled: reviewFields.length - solution.missing.length,
        total: reviewFields.length,
      });
    }
    if (solution.status === "needs_changes") {
      return solution.decisionMessage
        ? t("about.sentBack", { reason: solution.decisionMessage })
        : t("about.sentBackPlain");
    }
    if (solution.status === "rejected") {
      return t("about.rejected", {
        reason: solution.decisionMessage ?? reason(solution.decisionReason ?? "other"),
      });
    }
    if (solution.suspendedAt && solution.status === "approved") {
      return t("about.takenDown", {
        reason: solution.suspensionMessage ?? takedown(solution.suspensionReason ?? "other"),
      });
    }
    return solution.summary;
  };
}

type SolutionNameCellProps = {
  solution: SolutionSummary;
  /** The name as a link, where the row leads to the solution; plain text otherwise. */
  link?: ReactNode;
};

/** A solution's name over what it does or what happens next, as the solution lists show it. */
function SolutionNameCell({ solution, link }: SolutionNameCellProps) {
  const about = useSolutionAbout();

  return (
    <div className="grid min-w-0 text-sm">
      {link ?? <span className="truncate font-medium">{solution.name}</span>}
      <span className="truncate text-muted-foreground">{about(solution)}</span>
    </div>
  );
}

/** Where the review of a solution stands, as a pill. */
function SolutionReviewCell({ solution }: { solution: SolutionSummary }) {
  const t = useTranslations("Solution.mine");

  return (
    <Status appearance="pill" tone={reviewTones[reviewState(solution)]}>
      {t(`review.${reviewState(solution)}`)}
    </Status>
  );
}

/** Whether the public reads a solution, and how. */
function SolutionListingCell({ solution }: { solution: SolutionSummary }) {
  const t = useTranslations("Solution.mine");

  return <span>{t(`listing.${listingOf(solution)}`)}</span>;
}

export { SolutionListingCell, SolutionNameCell, SolutionReviewCell };
