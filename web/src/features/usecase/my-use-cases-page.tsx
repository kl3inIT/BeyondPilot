import { LightbulbIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ReviewStatus } from "@/components/composites/review-status";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrganizationFrame } from "@/features/organization/organization-frame";
import { OrganizationSection } from "@/features/organization/organization-section";
import { Link } from "@/i18n/navigation";
import type { MyOrganization, MyUseCases, Organization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { MyUseCaseActions } from "./my-use-case-actions";
import { PostUseCase } from "./post-use-case";
import { LiveRefresh } from "./live-refresh";

type MyUseCasesPageProps = {
  mine: MyOrganization & { organization: Organization };
  useCases: MyUseCases;
  /** How many members the organization has, for the tab beside this one. */
  members: number;
  /** How many solutions it has, when it is a provider as well. */
  solutions: number | null;
};

/** The statuses a use case is counted under, in the order the summary says them. */
const statuses = ["approved", "in_review", "needs_changes", "draft", "closed"] as const;

/**
 * My organization › Use cases: what the organization has asked providers for, each with where it
 * stands. Every member reads, writes and sends them; the tab opens the draft of a use case, or the
 * use case as it stands when it can no longer be changed.
 */
function MyUseCasesPage({ mine, useCases, members, solutions }: MyUseCasesPageProps) {
  const t = useTranslations("Organization.useCases");
  const format = useFormatter();
  const day = (instant: string) =>
    format.dateTime(new Date(instant), { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

  const rows = useCases.items.map((useCase) => {
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
      updated: <span className="text-muted-foreground">{day(useCase.updatedAt)}</span>,
      actions: <MyUseCaseActions useCase={useCase} />,
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
        action={<PostUseCase />}
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
            <DataTable className="hidden bg-background md:block">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.useCase")}</TableHead>
                  <TableHead className="w-36">{t("columns.status")}</TableHead>
                  <TableHead className="w-36">{t("columns.editedBy")}</TableHead>
                  <TableHead className="w-32">{t("columns.updated")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-0">{row.title}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.editedBy}</TableCell>
                    <TableCell>{row.updated}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">{row.actions}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>

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
