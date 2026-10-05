import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { CodeList } from "@/components/composites/code-list";
import { Link } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import type { PublicSolutionSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { SolutionLogo } from "./solution-logo";

/** How many capabilities a card names before it counts the rest. */
const CAPABILITY_LIMIT = 3;

/**
 * One solution in the directory: what it is called, who offers it, what it does and its
 * capabilities. The last line is the proof a card can state; no customer case can be published yet,
 * so it says so.
 */
function SolutionCard({ solution }: { solution: PublicSolutionSummary }) {
  const t = useTranslations("Solution.directory");
  const focusArea = useVocabulary("focusArea");

  return (
    <article className="relative flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-ring has-[h2>a:focus-visible]:border-ring has-[h2>a:focus-visible]:ring-3 has-[h2>a:focus-visible]:ring-ring/50">
      <div className="flex items-center gap-3">
        <SolutionLogo name={solution.name} size="card" />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h2 className="max-w-full truncate text-base font-medium">
            <Link
              href={`${siteRoutes.solutions}/${solution.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {/* Above the touch area of the link under it, so a tap on the name opens the solution. */}
              <span className="relative z-10">{solution.name}</span>
            </Link>
          </h2>
          <TextButton
            size="sm"
            href={`${siteRoutes.organizations}/${solution.organizationSlug}`}
            className="relative max-w-full"
          >
            <span className="truncate">{t("by", { name: solution.organizationName })}</span>
            <ArrowRightIcon aria-hidden="true" />
          </TextButton>
        </div>
      </div>
      {solution.summary && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{solution.summary}</p>
      )}
      <CodeList
        labels={solution.focusAreas.map(focusArea)}
        limit={CAPABILITY_LIMIT}
        more={(count) => t("more", { count })}
      />
      <p className="mt-auto pt-1.5 text-xs font-medium text-muted-foreground">
        {solution.customerDeployments > 0
          ? t("deployments", { count: solution.customerDeployments })
          : t("noCase")}
      </p>
    </article>
  );
}

export { SolutionCard };
