import { BadgeCheckIcon, FileTextIcon, ImageIcon, LayersIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { CodeList } from "@/components/composites/code-list";
import { Link } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import type { PublicSolutionSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

import { SolutionLogo } from "./solution-logo";

/** How many capabilities a card names before it counts the rest. */
const CAPABILITY_LIMIT = 3;

/**
 * One solution in the directory: its cover with its logo over the corner, what it is called, who
 * offers it, what it does and its capabilities. The last line is the proof a card can state: how
 * many customer deployments GenAI Fund approved, or that none is published.
 */
function SolutionCard({ solution }: { solution: PublicSolutionSummary }) {
  const t = useTranslations("Solution.directory");
  const focusArea = useVocabulary("focusArea");

  return (
    <article className="relative flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-ring has-[h2>a:focus-visible]:border-ring has-[h2>a:focus-visible]:ring-3 has-[h2>a:focus-visible]:ring-ring/50">
      {/* The logo hangs over the foot of the cover, so the pair takes its height and half the logo's. */}
      <div className="relative mb-5">
        <div className="relative flex h-35 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">
          {solution.coverFileId ? (
            <Image
              src={publicFileUrl(solution.coverFileId)}
              alt=""
              fill
              sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
              unoptimized
              className="object-cover"
            />
          ) : (
            <ImageIcon className="size-6" aria-hidden="true" />
          )}
        </div>
        <SolutionLogo
          name={solution.name}
          fileId={solution.logoFileId}
          size="card"
          className="absolute -bottom-5 left-4 shadow-sm"
        />
      </div>
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
        </TextButton>
      </div>
      {solution.summary && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{solution.summary}</p>
      )}
      {solution.focusAreas.length > 0 && (
        <div className="flex items-start gap-2">
          <LayersIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <CodeList
            labels={solution.focusAreas.map(focusArea)}
            limit={CAPABILITY_LIMIT}
            more={t("more", { count: solution.focusAreas.length - CAPABILITY_LIMIT })}
          />
        </div>
      )}
      {/* What GenAI Fund says of it: the programme it was selected for, or who backs its company. */}
      {solution.backing && (
        <p className="flex items-center gap-2 text-xs font-medium">
          <BadgeCheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
          <span className="sr-only">{t("backing")}</span>
          {solution.backing}
        </p>
      )}
      {solution.customerDeployments > 0 ? (
        <p className="mt-auto flex items-center gap-2 pt-1.5 text-xs font-medium">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {t("deployments", { count: solution.customerDeployments })}
        </p>
      ) : (
        <p className="mt-auto pt-1.5 text-xs font-medium text-muted-foreground">{t("noCase")}</p>
      )}
    </article>
  );
}

export { SolutionCard };
