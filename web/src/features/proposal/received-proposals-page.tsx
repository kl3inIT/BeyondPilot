import { ArrowLeftIcon, InboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Badge } from "@/components/ui/badge";
import { Status } from "@/components/composites/status";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { useFormatter } from "@/i18n/format";
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
              href={workspaceUseCaseProposalRoute(useCase.id, proposal.id)}
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
      // Every received proposal is new: there is no decision to tell them apart by yet.
      status: <Status tone="info">{t("status.new")}</Status>,
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
            <DataTableRows
              className="hidden md:flex"
              surface
              columns={[
                { id: "proposal", header: t("list.columns.proposal"), layout: { fill: true } },
                { id: "status", header: t("list.columns.status"), layout: { width: "md" } },
                { id: "sent", header: t("list.columns.sent"), layout: { width: "md" } },
              ]}
              rows={rows.map((row) => ({
                id: row.id,
                cells: { proposal: row.proposal, status: row.status, sent: row.sent },
              }))}
            />

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
