import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { useFormatter } from "@/i18n/format";
import type { ReceivedUseCaseProposals } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import type { ProposalTab, ReceivedView } from "./received-proposals";
import { ReceivedProposalsList } from "./received-proposals-list";

type ReceivedProposalsPageProps = {
  proposals: ReceivedUseCaseProposals;
  tab: ProposalTab;
  view?: ReceivedView;
  /** The proposals of the tab compared against the use case's requirements, for the Compare view. */
  compare?: React.ReactNode;
};

/**
 * The proposals a use case received, as the organization that posted it reads them: the way to send
 * the outcomes, the tabs by decision, and one line each, the latest first, opening the proposal.
 */
function ReceivedProposalsPage({ proposals, tab, view, compare }: ReceivedProposalsPageProps) {
  const t = useTranslations("UseCaseProposal.received");
  const format = useFormatter();
  const { useCase } = proposals;

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12">
      <div className="flex w-full max-w-300 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <TextButton href={siteRoutes.workspaceUseCases} className="self-start">
            <ArrowLeftIcon aria-hidden="true" />
            {t("list.back")}
          </TextButton>
          <h1 className="text-3xl font-semibold tracking-tight break-words">{useCase.title}</h1>
          {useCase.closesAt && (
            <p className="text-sm text-muted-foreground">
              {t("list.closes", {
                when: format.dateTime(new Date(useCase.closesAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Ho_Chi_Minh",
                }),
              })}
            </p>
          )}
        </div>

        <ReceivedProposalsList
          useCaseId={useCase.id}
          proposals={proposals}
          tab={tab}
          area="workspace"
          view={view}
          compare={compare}
        />
      </div>
    </div>
  );
}

export { ReceivedProposalsPage };
