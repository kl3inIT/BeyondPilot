import { LightbulbIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ReviewStatus } from "@/components/composites/review-status";
import { OrganizationFrame } from "@/features/organization/organization-frame";
import { OrganizationSection } from "@/features/organization/organization-section";
import { Link } from "@/i18n/navigation";
import type { MyOrganization, MyUseCases, Organization } from "@/lib/api/generated";
import { siteRoutes, workspaceUseCaseProposalsRoute } from "@/lib/site";

import { proposalsShown } from "@/features/proposal/received-proposals";

import { MyUseCaseActions } from "./my-use-case-actions";
import { sortMyUseCases, type MyUseCasesSearch } from "./my-use-cases-search";
import { PostUseCase } from "./post-use-case";
import { LiveRefresh } from "./live-refresh";

type MyUseCasesPageProps = {
  mine: MyOrganization & { organization: Organization };
  useCases: MyUseCases;
  /** How many members the organization has, for the tab beside this one. */
  members: number;
  /** How many solutions it has, when it is a provider as well. */
  solutions: number | null;
  /** How many proposals each published use case received; null when the count could not be read. */
  proposals: Map<string, number> | null;
  /** The order of the use cases, from the URL. */
  search: MyUseCasesSearch;
};

/** The statuses a use case is counted under, in the order the summary says them. */
const statuses = ["approved", "in_review", "needs_changes", "draft", "closed"] as const;

/**
 * My organization › Use cases: what the organization has asked providers for, each with where it
 * stands. Every member reads, writes and sends them; the tab opens the draft of a use case, or the
 * use case as it stands when it can no longer be changed.
 */
function MyUseCasesPage({
  mine,
  useCases,
  members,
  solutions,
  proposals,
  search,
}: MyUseCasesPageProps) {
  const t = useTranslations("Organization.useCases");
  const p = useTranslations("UseCaseProposal.received");
  const format = useFormatter();
  const day = (instant: string) =>
    format.dateTime(new Date(instant), { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

  const sorted = sortMyUseCases(useCases.items, proposals, search);
  const rows = sorted.items.map((useCase) => {
    const address = `${siteRoutes.workspaceUseCases}/${useCase.id}`;
    const name = useCase.title ?? t("untitled");
    const date = useCase.closesAt ? day(useCase.closesAt) : "";
    const note =
      useCase.status === "in_review"
        ? t("note.in_review", { date: useCase.submittedAt ? day(useCase.submittedAt) : "" })
        : useCase.status === "approved" || useCase.status === "closed"
          ? t(`note.${useCase.status}`, { date })
          : t(`note.${useCase.status}`);
    const editor = useCase.lastEditedBy;
    const received = proposalsShown(useCase.status, proposals?.get(useCase.id));

    return {
      id: useCase.id,
      title: (
        <div className="grid min-w-0 text-sm">
          <Link
            href={address}
            className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {name}
          </Link>
          <span className="truncate text-muted-foreground">{note}</span>
        </div>
      ),
      status: <ReviewStatus state={useCase.status}>{t(`status.${useCase.status}`)}</ReviewStatus>,
      editedBy: (
        <span className="text-sm">
          {editor.you ? t("you") : editor.genaiFund ? t("genaiFund") : editor.name}
        </span>
      ),
      proposals:
        received === null || proposals === null ? (
          <span aria-label={p("none")} className="text-muted-foreground">
            –
          </span>
        ) : (
          <Link
            href={workspaceUseCaseProposalsRoute(useCase.id)}
            className="rounded-sm text-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {p("count", { count: received })}
          </Link>
        ),
      updated: <span className="text-muted-foreground">{day(useCase.updatedAt)}</span>,
      actions: <MyUseCaseActions useCase={useCase} viewProposals={received !== null} />,
    };
  });

  const count = (status: (typeof statuses)[number]) =>
    useCases.items.filter((useCase) => useCase.status === status).length;
  const summary = statuses
    .filter((status) => count(status) > 0)
    .map((status) => t(`summary.${status}`, { count: count(status) }))
    .join(" · ");

  return (
    <OrganizationFrame
      mine={mine}
      current="useCases"
      counts={{ members, solutions, useCases: useCases.items.length }}
    >
      <LiveRefresh />
      <OrganizationSection
        id="use-cases-list"
        title={t("title")}
        summary={rows.length > 0 ? summary : undefined}
        action={<PostUseCase size="lg" />}
      >
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-background">
            <DataTableEmpty
              icon={<LightbulbIcon aria-hidden="true" />}
              title={t("empty.title")}
              description={t("empty.description")}
            />
          </div>
        ) : (
          <>
            {/* From 768px: a table. */}
            <DataTableRows
              className="hidden md:flex"
              surface
              sortKeys={sorted.sortKeys}
              defaultSort={sorted.defaultSort}
              columns={[
                { id: "useCase", header: t("columns.useCase"), layout: { fill: true } },
                { id: "status", header: t("columns.status"), layout: { width: "md" } },
                {
                  id: "proposals",
                  header: p("column"),
                  layout: { width: "sm", descFirst: true },
                },
                { id: "editedBy", header: t("columns.editedBy"), layout: { width: "md" } },
                {
                  id: "updated",
                  header: t("columns.updated"),
                  layout: { width: "sm", descFirst: true },
                },
                {
                  id: "actions",
                  header: <span className="sr-only">{t("columns.actions")}</span>,
                  layout: { width: "action" },
                },
              ]}
              rows={rows.map((row) => ({
                id: row.id,
                cells: {
                  useCase: row.title,
                  status: row.status,
                  proposals: row.proposals,
                  editedBy: row.editedBy,
                  updated: row.updated,
                  actions: <div className="flex justify-end">{row.actions}</div>,
                },
              }))}
            />

            {/* Below 768px: one stacked row per use case, never a table scrolled sideways. */}
            <ul className="overflow-hidden rounded-lg border bg-background md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    {row.title}
                    {row.actions}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {row.status}
                    {row.proposals}
                    {row.editedBy}
                    {row.updated}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </OrganizationSection>
    </OrganizationFrame>
  );
}

export { MyUseCasesPage };
