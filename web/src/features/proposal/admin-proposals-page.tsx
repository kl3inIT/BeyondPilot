import { InboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ReviewStatus } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { UseCaseTabs } from "@/features/usecase/use-case-tabs";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { MyUseCase, ReceivedUseCaseProposals } from "@/lib/api/generated";
import { adminUseCaseProposalRoute } from "@/lib/site";

import { proposalLine } from "./received-proposals";

type AdminProposalsPageProps = {
  useCase: {
    id: string;
    title?: string | null;
    status: MyUseCase["status"];
    organizationName: string;
  };
  proposals: ReceivedUseCaseProposals;
};

/**
 * The Proposals page of a use case, as GenAI Fund reads it: one line for each proposal it received,
 * the latest first, opening the proposal. Operators decide nothing here yet, so the lines carry no
 * status.
 */
function AdminProposalsPage({ useCase, proposals }: AdminProposalsPageProps) {
  const t = useTranslations("UseCaseProposal.received");
  const statusLabel = useTranslations("Admin.useCases.status");
  const format = useFormatter();
  const { items } = proposals;
  const day = (instant: string) => format.dateTime(new Date(instant), "date");

  const rows = items.map((proposal) => {
    const detail = proposalLine(proposal.solutionNames, proposal.contactName);
    return {
      id: proposal.id,
      proposal: (
        <div className="flex min-w-0 items-center gap-3">
          <OrganizationMark
            size="sm"
            name={proposal.organizationName}
            logoFileId={proposal.organizationLogoFileId}
          />
          <div className="grid min-w-0 text-sm">
            <Link
              href={adminUseCaseProposalRoute(useCase.id, proposal.id)}
              className="truncate rounded-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {proposal.organizationName}
            </Link>
            {!proposal.organizationApproved && (
              <Badge variant="secondary" className="self-start">
                {t("detail.pending")}
              </Badge>
            )}
            {detail && <span className="truncate text-muted-foreground">{detail}</span>}
          </div>
        </div>
      ),
      sent: (
        <span className="text-muted-foreground">
          {day(proposal.sentAt)}
          {proposal.editedAt && (
            <span className="block text-xs">{t("edited", { date: day(proposal.editedAt) })}</span>
          )}
        </span>
      ),
    };
  });

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
        >
          <UseCaseTabs area="admin" id={useCase.id} current="proposals" proposals={items.length} />
        </AdminPageHeader>

        {rows.length === 0 ? (
          <div className="rounded-lg border bg-background">
            <DataTableEmpty
              icon={<InboxIcon aria-hidden="true" />}
              title={t("list.empty.title")}
              description={t("list.empty.description")}
            />
          </div>
        ) : (
          <>
            {/* From 768px: a table. */}
            <DataTable className="hidden bg-background md:block">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.columns.proposal")}</TableHead>
                  <TableHead className="w-44">{t("list.columns.sent")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-0">{row.proposal}</TableCell>
                    <TableCell>{row.sent}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>

            {/* Below 768px: one stacked row per proposal, never a table scrolled sideways. */}
            <ul className="overflow-hidden rounded-lg border bg-background md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
                  {row.proposal}
                  <div className="text-sm">{row.sent}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export { AdminProposalsPage };
