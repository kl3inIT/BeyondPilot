import { ArrowLeftIcon, CircleAlertIcon, CircleCheckIcon, TimerIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { ReviewStatus } from "@/components/composites/review-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CustomerDeploymentsEditor } from "./customer-deployments-editor";
import { SolutionForm } from "./solution-form";
import { SolutionView } from "./solution-view";

type SolutionEditorPageProps = {
  solution: Solution;
  /** Whether the caller may change the organization's solutions; a member reads. */
  editable: boolean;
};

/** My organization › Solutions › one solution: where its review stands, then its editor or, for a member, its content. */
function SolutionEditorPage({ solution, editable }: SolutionEditorPageProps) {
  const t = useTranslations("Solution.editor");
  const status = useVocabulary("reviewStatus");
  const reason = useVocabulary("solutionRejection");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10 md:px-8">
      <TextButton href={siteRoutes.workspaceSolutions} className="self-start">
        <ArrowLeftIcon aria-hidden="true" />
        {t("back")}
      </TextButton>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{solution.name}</h1>
        <ReviewStatus state={solution.status}>{status(solution.status)}</ReviewStatus>
      </div>

      {solution.status === "submitted" && (
        <Alert className="max-w-3xl">
          <TimerIcon aria-hidden="true" />
          <AlertTitle>{t("submitted.title")}</AlertTitle>
          <AlertDescription>{t("submitted.lead")}</AlertDescription>
        </Alert>
      )}
      {solution.status === "approved" && (
        <Alert className="max-w-3xl">
          <CircleCheckIcon aria-hidden="true" />
          <AlertTitle>{t(solution.listed ? "approved.listed" : "approved.unlisted")}</AlertTitle>
          <AlertDescription>
            {solution.listed ? (
              <TextButton href={`${siteRoutes.solutions}/${solution.slug}`} size="md">
                {t("approved.open")}
              </TextButton>
            ) : (
              t("approved.unlistedLead")
            )}
          </AlertDescription>
        </Alert>
      )}
      {solution.status === "rejected" && (
        <Alert variant="destructive" className="max-w-3xl">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>
            {t("rejected.title", { reason: reason(solution.decisionReason ?? "other") })}
          </AlertTitle>
          <AlertDescription>
            {solution.decisionMessage && <p>{solution.decisionMessage}</p>}
            <p>{t("rejected.lead")}</p>
          </AlertDescription>
        </Alert>
      )}

      {editable ? (
        // The key gives a saved solution a fresh form, so it holds the new version.
        <>
          <SolutionForm key={`${solution.version}-${solution.status}`} solution={solution} />
          <CustomerDeploymentsEditor
            solutionId={solution.id}
            deployments={solution.customerDeployments}
          />
        </>
      ) : (
        <SolutionView solution={solution} />
      )}
    </div>
  );
}

export { SolutionEditorPage };
