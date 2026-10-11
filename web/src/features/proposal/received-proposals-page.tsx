import { ArrowLeftIcon, InboxIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { Status } from "@/components/composites/status";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { Link } from "@/i18n/navigation";
import type { ReceivedUseCaseProposals } from "@/lib/api/generated";
import { siteRoutes, workspaceUseCaseProposalRoute } from "@/lib/site";

import { proposalLine } from "./received-proposals";

type ReceivedProposalsPageProps = {
  proposals: ReceivedUseCaseProposals;
};

const tabClass =
  "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground aria-disabled:opacity-50";

/**
 * The proposals a use case received, as the organization that posted it reads them: one line each,
 * the latest first, opening the proposal. Shortlisted and Declined are drawn but wait for the
 * decision a later change adds.
 */
function ReceivedProposalsPage({ proposals }: ReceivedProposalsPageProps) {
  const t = useTranslations("UseCaseProposal.received");
  const format = useFormatter();
  const { useCase, items } = proposals;
  const day = (instant: string) =>
    format.dateTime(new Date(instant), { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

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
              href={workspaceUseCaseProposalRoute(useCase.id, proposal.id)}
              className="truncate rounded-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {proposal.organizationName}
            </Link>
            {detail && <span className="truncate text-muted-foreground">{detail}</span>}
          </div>
        </div>
      ),
      // Every received proposal is new: there is no decision to tell them apart by yet.
      status: <Status tone="info">{t("status.new")}</Status>,
      sent: <span className="text-muted-foreground">{day(proposal.sentAt)}</span>,
    };
  });

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
                  hourCycle: "h23",
                  timeZoneName: "short",
                  timeZone: "Asia/Ho_Chi_Minh",
                }),
              })}
            </p>
          )}
        </div>

        <nav aria-label={t("tabs.label")} className="flex items-end gap-5 border-b">
          <span aria-current="page" className={tabClass}>
            {t("tabs.all")}
            <span className="text-xs">{items.length}</span>
          </span>
          {(["shortlisted", "declined"] as const).map((tab) => (
            <span key={tab} aria-disabled="true" className={tabClass}>
              {t(`tabs.${tab}`)}
              <span className="text-xs">0</span>
            </span>
          ))}
        </nav>

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
                  <TableHead className="w-36">{t("list.columns.status")}</TableHead>
                  <TableHead className="w-36">{t("list.columns.sent")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-0">{row.proposal}</TableCell>
                    <TableCell>{row.status}</TableCell>
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {row.status}
                    {row.sent}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export { ReceivedProposalsPage };
