import { CircleAlertIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { NeedCoverage } from "./matching-view";

type MatchingCoverageProps = {
  /** How many candidates the run recommends. */
  recommended: number;
  coverage: NeedCoverage[];
};

/**
 * What the recommended candidates cover together: how many of the use case's needs at least one of
 * them meets, a bar with a segment per need, and each need nobody on BeyondPilot shows.
 */
function MatchingCoverage({ recommended, coverage }: MatchingCoverageProps) {
  const t = useTranslations("Matching.coverage");
  const covered = coverage.filter((need) => need.best === "met").length;
  const gaps = coverage.filter((need) => need.best === "not_shown");

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <SparklesIcon aria-hidden="true" className="hidden size-5 shrink-0 text-primary sm:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold">
          {t("recommended", { count: recommended })}
          {coverage.length > 0 && ` · ${t("covered", { covered, total: coverage.length })}`}
        </p>
        {gaps.map((need) => (
          <p key={need.position} className="flex items-start gap-1.5 text-xs text-destructive">
            <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {t("gap", { need: need.name })}
          </p>
        ))}
      </div>
      {coverage.length > 0 && (
        <div aria-hidden="true" className="flex w-full items-center gap-1 sm:w-auto sm:shrink-0">
          {coverage.map((need) => (
            <span
              key={need.position}
              data-status={need.best}
              className={cn(
                "h-1.5 max-w-10 flex-1 rounded-full sm:w-10 sm:flex-none",
                need.best === "met" && "bg-success",
                need.best === "partly" && "bg-warning",
                need.best === "not_shown" && "bg-border",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export { MatchingCoverage };
