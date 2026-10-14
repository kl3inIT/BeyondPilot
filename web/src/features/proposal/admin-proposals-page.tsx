import { useTranslations } from "next-intl";

import { ReviewStatus } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { UseCaseTabs } from "@/features/usecase/use-case-tabs";
import type { MyUseCase, ReceivedUseCaseProposals } from "@/lib/api/generated";

import type { ProposalTab } from "./received-proposals";
import { ReceivedProposalsList } from "./received-proposals-list";
import { ExportProposals } from "./export-proposals";

type AdminProposalsPageProps = {
  useCase: {
    id: string;
    title?: string | null;
    status: MyUseCase["status"];
    organizationName: string;
  };
  proposals: ReceivedUseCaseProposals;
  tab: ProposalTab;
};

/**
 * The Proposals page of a use case, as GenAI Fund reads it: the same list as the organization that
 * posted the use case has, with the same decisions, menus and way to send the outcomes.
 */
function AdminProposalsPage({ useCase, proposals, tab }: AdminProposalsPageProps) {
  const statusLabel = useTranslations("Admin.useCases.status");

  return (
    <div className="flex flex-1 justify-center px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-5">
        <AdminPageHeader
          title={useCase.title}
          badges={
            <ReviewStatus appearance="pill" state={useCase.status}>
              {statusLabel(useCase.status)}
            </ReviewStatus>
          }
          lead={useCase.organizationName}
          actions={
            <ExportProposals useCaseId={useCase.id} disabled={proposals.items.length === 0} />
          }
        >
          <UseCaseTabs
            area="admin"
            id={useCase.id}
            current="proposals"
            proposals={proposals.items.length}
          />
        </AdminPageHeader>

        <ReceivedProposalsList
          useCaseId={useCase.id}
          proposals={proposals}
          tab={tab}
          area="admin"
        />
      </div>
    </div>
  );
}

export { AdminProposalsPage };
