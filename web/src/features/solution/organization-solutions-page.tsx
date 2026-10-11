import { BoxesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrganizationFrame } from "@/features/organization/organization-frame";
import { OrganizationSection } from "@/features/organization/organization-section";
import { Link } from "@/i18n/navigation";
import type { MyOrganization, MySolutions, Organization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CreateSolution } from "./create-solution";
import { SolutionRowActions } from "./solution-row-actions";
import { SolutionListingCell, SolutionNameCell, SolutionReviewCell } from "./solution-row-cells";

type OrganizationSolutionsPageProps = {
  mine: MyOrganization & { organization: Organization };
  solutions: MySolutions;
  /** How many members the organization has, for the tab beside this one. */
  members: number;
  /** How many use cases it has, when it is an approved enterprise. */
  useCases: number | null;
};

/**
 * My organization › Solutions: what the organization offers, each with where its review stands,
 * whether the public reads it, and what a member can do with it next. Every member adds and
 * changes them.
 */
function OrganizationSolutionsPage({
  mine,
  solutions,
  members,
  useCases,
}: OrganizationSolutionsPageProps) {
  const t = useTranslations("Solution.mine");
  const format = useFormatter();
  const waiting =
    mine.role === "owner" &&
    (mine.organization.status !== "approved" || !!mine.organization.suspendedAt);
  const day = (instant: string) => format.dateTime(new Date(instant), { dateStyle: "medium" });

  const rows = solutions.items.map((solution) => {
    const editor = `${siteRoutes.workspaceSolutions}/${solution.id}`;
    return {
      id: solution.id,
      name: (
        <SolutionNameCell
          solution={solution}
          link={
            <Link
              href={editor}
              className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {solution.name}
            </Link>
          }
        />
      ),
      status: <SolutionReviewCell solution={solution} />,
      listing: <SolutionListingCell solution={solution} />,
      updated: (
        <span className="text-muted-foreground">
          {solution.status === "in_review" && solution.submittedAt
            ? t("sent", { date: day(solution.submittedAt) })
            : day(solution.updatedAt)}
        </span>
      ),
      actions: <SolutionRowActions solution={solution} editable={solutions.editable} />,
    };
  });

  return (
    <OrganizationFrame
      mine={mine}
      current="solutions"
      counts={{ members, solutions: solutions.items.length, useCases }}
    >
      <OrganizationSection
        id="solutions-list"
        title={t("title")}
        summary={rows.length > 0 ? String(rows.length) : undefined}
        action={solutions.editable && <CreateSolution />}
      >
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-background">
            <DataTableEmpty
              icon={<BoxesIcon aria-hidden="true" />}
              title={t("empty.title")}
              description={
                solutions.editable ? undefined : t(waiting ? "afterApproval" : "empty.member")
              }
            />
          </div>
        ) : (
          <>
            {/* From 768px: a table. */}
            <DataTable className="hidden bg-background md:block">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.solution")}</TableHead>
                  <TableHead className="w-36">{t("columns.status")}</TableHead>
                  <TableHead className="w-44">{t("columns.listing")}</TableHead>
                  <TableHead className="w-36">{t("columns.updated")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-0">{row.name}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.listing}</TableCell>
                    <TableCell>{row.updated}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">{row.actions}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>

            {/* Below 768px: one stacked row per solution, never a table scrolled sideways. */}
            <ul className="overflow-hidden rounded-lg border bg-background md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    {row.name}
                    {row.actions}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {row.status}
                    {row.listing}
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

export { OrganizationSolutionsPage };
