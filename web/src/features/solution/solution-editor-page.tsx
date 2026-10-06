import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { ReviewStatus } from "@/components/composites/review-status";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { SolutionEditor } from "./solution-editor";
import { SolutionView } from "./solution-view";

type SolutionEditorPageProps = {
  solution: Solution;
  /** Whether the caller may change the organization's solutions; a member reads. */
  editable: boolean;
};

/**
 * My organization › Solutions › one solution, on a page of its own without the site's navigation,
 * so nothing pulls a person away mid-way: its editor in steps for an owner, its content for a member.
 */
function SolutionEditorPage({ solution, editable }: SolutionEditorPageProps) {
  const t = useTranslations("Solution.editor");
  const site = useTranslations("Site");
  const status = useVocabulary("reviewStatus");

  if (editable) {
    // One editor per solution: it keeps what is typed while the page reads the backend again.
    return <SolutionEditor key={solution.id} solution={solution} />;
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {site("skipToContent")}
      </a>
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-360 items-center justify-between gap-4 px-5 md:px-8">
          <BrandLockup showBackedBy={false} />
          <TextButton href={siteRoutes.workspaceSolutions}>
            <ArrowLeftIcon aria-hidden="true" />
            {t("back")}
          </TextButton>
        </div>
      </header>
      <main
        id="content"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10 md:px-8"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{solution.name}</h1>
          <ReviewStatus state={solution.status}>{status(solution.status)}</ReviewStatus>
        </div>
        <SolutionView solution={solution} />
      </main>
    </div>
  );
}

export { SolutionEditorPage };
