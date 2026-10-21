import { InboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ReviewStatus } from "@/components/composites/review-status";
import { Status } from "@/components/composites/status";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { ReceivedUseCaseProposals } from "@/lib/api/generated";
import {
  adminUseCaseProposalRoute,
  adminUseCaseProposalsRoute,
  workspaceUseCaseProposalRoute,
  workspaceUseCaseProposalsRoute,
} from "@/lib/site";

import { ProposalRowMenu, SendOutcomes } from "./proposal-decision";
import {
  decisionTone,
  inTab,
  pendingOutcomes,
  proposalLine,
  proposalTabs,
  receivedHref,
  type ProposalTab,
  type ReceivedView,
} from "./received-proposals";
import { ReceivedViewSwitch } from "./received-view-switch";

type ReceivedProposalsListProps = {
  useCaseId: string;
  proposals: ReceivedUseCaseProposals;
  tab: ProposalTab;
  /** Whose pages the rows open: the organization's own, or the operators'. */
  area: "workspace" | "admin";
  /** List, or the proposals of the tab side by side; List when absent. */
  view?: ReceivedView;
  /** The proposals of the tab compared, shown in the place of the lines when the view is Compare. */
  compare?: React.ReactNode;
};

const tabClass =
  "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground pointer-coarse:min-h-11";

/**
 * What the proposals of a use case show for the team that reads them: the way to send the outcomes,
 * the tabs All, Shortlisted and Declined with their counts, and one line for each proposal with its
 * state and its menu. The tab is the `?tab=` of the address. Given a comparison, a switch beside the
 * tabs offers it in the place of the lines, as `?view=compare`.
 */
function ReceivedProposalsList({
  useCaseId,
  proposals,
  tab,
  area,
  view = "list",
  compare,
}: ReceivedProposalsListProps) {
  const t = useTranslations("UseCaseProposal.received");
  const format = useFormatter();
  const { items } = proposals;
  const admin = area === "admin";
  const day = (instant: string) => format.dateTime(new Date(instant), "date");
  const base = admin
    ? adminUseCaseProposalsRoute(useCaseId)
    : workspaceUseCaseProposalsRoute(useCaseId);
  const proposalRoute = admin ? adminUseCaseProposalRoute : workspaceUseCaseProposalRoute;
  const counts = {
    all: items.length,
    shortlisted: proposals.shortlisted,
    declined: proposals.declined,
  };
  const waiting = pendingOutcomes(items);
  const shown = inTab(items, tab);

  const rows = shown.map((proposal) => {
    const detail = proposalLine(proposal.solutionNames, proposal.contactName);
    const href = proposalRoute(useCaseId, proposal.id);
    const state = proposal.decision ?? "undecided";
    return {
      id: proposal.id,
      proposal: (
        <div className="flex min-w-0 items-center gap-3">
          <OrganizationMark
            size="sm"
            name={proposal.organizationName}
            logoFileId={proposal.organizationLogoFileId}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={href}
                title={proposal.organizationName}
                className="min-w-0 truncate rounded-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {proposal.organizationName}
              </Link>
              {admin && !proposal.organizationActive && (
                <ReviewStatus state="suspended" appearance="pill">
                  {t("detail.takenDown")}
                </ReviewStatus>
              )}
            </div>
            {detail && (
              <span title={detail} className="truncate text-xs text-muted-foreground">
                {detail}
              </span>
            )}
          </div>
        </div>
      ),
      status: <Status tone={decisionTone(proposal.decision)}>{t(`status.${state}`)}</Status>,
      sent: (
        <span className="text-muted-foreground">
          {day(proposal.sentAt)}
          {proposal.editedAt && (
            <span className="block text-xs">{t("edited", { date: day(proposal.editedAt) })}</span>
          )}
        </span>
      ),
      actions: (
        <div className="flex justify-end">
          <ProposalRowMenu
            proposalId={proposal.id}
            name={proposal.organizationName}
            decision={proposal.decision}
            href={href}
          />
        </div>
      ),
    };
  });

  return (
    <>
      {items.length > 0 && (
        <div className="flex justify-end">
          <SendOutcomes useCaseId={useCaseId} pending={waiting} />
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3 border-b">
        <nav aria-label={t("tabs.label")} className="flex items-end gap-5">
          {proposalTabs.map((key) => (
            <Link
              key={key}
              href={receivedHref(base, key, compare ? view : "list")}
              aria-current={key === tab ? "page" : undefined}
              className={tabClass}
            >
              {t(`tabs.${key}`)}
              <span className="text-xs">{counts[key]}</span>
            </Link>
          ))}
        </nav>
        {compare && items.length > 0 && (
          <div className="pb-2">
            <ReceivedViewSwitch
              view={view}
              hrefs={{
                list: receivedHref(base, tab, "list"),
                compare: receivedHref(base, tab, "compare"),
              }}
            />
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-background">
          <DataTableEmpty
            icon={<InboxIcon aria-hidden="true" />}
            title={t(items.length === 0 ? "list.empty.title" : "list.emptyTab.title")}
            description={t(
              items.length === 0 ? "list.empty.description" : "list.emptyTab.description",
            )}
          />
        </div>
      ) : compare && view === "compare" ? (
        compare
      ) : (
        <DataTableRows
          surface
          columns={[
            {
              id: "proposal",
              header: admin ? (
                <span className="block max-md:min-w-64">{t("list.columns.proposal")}</span>
              ) : (
                t("list.columns.proposal")
              ),
              layout: { fill: true },
            },
            { id: "status", header: t("list.columns.status"), layout: { width: "md" } },
            { id: "sent", header: t("list.columns.sent"), layout: { width: "md" } },
            {
              id: "actions",
              header: <span className="sr-only">{t("list.columns.actions")}</span>,
              layout: { width: "action" },
            },
          ]}
          rows={rows.map((row) => ({
            id: row.id,
            cells: {
              proposal: row.proposal,
              status: row.status,
              sent: row.sent,
              actions: row.actions,
            },
          }))}
        />
      )}
    </>
  );
}

export { ReceivedProposalsList };
