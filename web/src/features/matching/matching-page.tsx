import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { ReviewStatus } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { UseCaseTabs } from "@/features/usecase/use-case-tabs";
import type { Matching, MyUseCase } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

import { MatchingBoard } from "./matching-board";

type MatchingPageProps = {
  /** Whose page it is: the organization's own, inside the site, or the operators', inside Admin. */
  area: "workspace" | "admin";
  useCase: {
    id: string;
    title?: string | null;
    status: MyUseCase["status"];
    organizationName: string;
  };
  matching: Matching;
  /** How many proposals the use case received, for the tab GenAI Fund has for them. */
  proposals?: number;
  /** The solution to open with the page, by the identifier matching gives it. */
  selected?: string;
};

/**
 * The Matched solutions page of a use case: the solutions matched to it, why each fits, and what people
 * decide on them. The organization's members and GenAI Fund read the same page; the answer of the
 * backend says what each may do.
 */
function MatchingPage({ area, useCase, matching, proposals, selected }: MatchingPageProps) {
  const t = useTranslations("Matching");
  const statusLabel = useTranslations("Admin.useCases.status");
  const admin = area === "admin";
  const status = (
    <ReviewStatus appearance="pill" state={useCase.status}>
      {statusLabel(useCase.status)}
    </ReviewStatus>
  );

  return (
    <div
      className={cn(
        "flex flex-1 justify-center",
        admin ? "px-4 pt-2 pb-12 md:px-6 lg:px-8" : "bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12",
      )}
    >
      <div className={cn("flex w-full flex-col gap-5", !admin && "max-w-300")}>
        {admin ? (
          <AdminPageHeader
            title={useCase.title ?? t("head.untitled")}
            badges={status}
            lead={useCase.organizationName}
          >
            <UseCaseTabs area={area} id={useCase.id} current="candidates" proposals={proposals} />
          </AdminPageHeader>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <TextButton href={siteRoutes.workspaceUseCases} className="self-start">
                <ArrowLeftIcon aria-hidden="true" />
                {t("head.back", { organization: useCase.organizationName })}
              </TextButton>
              <h1 className="text-3xl font-semibold tracking-tight break-words">
                {useCase.title ?? t("head.untitled")}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm">{status}</div>
            </div>

            <UseCaseTabs area={area} id={useCase.id} current="candidates" proposals={proposals} />
          </>
        )}

        <MatchingBoard matching={matching} selected={selected} />
      </div>
    </div>
  );
}

export { MatchingPage };
