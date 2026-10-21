import { BoxesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { OrganizationFrame } from "@/features/organization/organization-frame";
import { isActive } from "@/features/organization/organization-format";
import { OrganizationSection } from "@/features/organization/organization-section";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { MyOrganization, MySolutions, Organization, OwnOffer } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CreateSolution } from "./create-solution";
import { OrganizationOffers } from "./organization-offers";
import {
  sortOrganizationSolutions,
  type OrganizationSolutionsSearch,
} from "./organization-solutions-search";
import { SolutionRowActions } from "./solution-row-actions";
import { SolutionListingCell, SolutionNameCell, SolutionReviewCell } from "./solution-row-cells";

type OrganizationSolutionsPageProps = {
  mine: MyOrganization & { organization: Organization };
  solutions: MySolutions;
  /** The offers the organization wrote for its solutions. */
  offers: OwnOffer[];
  /** How many members the organization has, for the tab beside this one. */
  members: number;
  /** How many use cases it has, when it is an enterprise that is not taken down. */
  useCases: number | null;
  /** The order of the solutions, from the URL. */
  search: OrganizationSolutionsSearch;
};

/**
 * My organization › Solutions: what the organization offers, each with where its review stands,
 * whether the public reads it, and what a member can do with it next. Every member adds and
 * changes them.
 */
function OrganizationSolutionsPage({
  mine,
  solutions,
  offers,
  members,
  useCases,
  search,
}: OrganizationSolutionsPageProps) {
  const t = useTranslations("Solution.mine");
  const format = useFormatter();
  const takenDown = mine.role === "owner" && !isActive(mine.organization);
  const day = (instant: string) => format.dateTime(new Date(instant), "date");

  const sorted = sortOrganizationSolutions(solutions.items, search);
  const rows = sorted.items.map((solution) => {
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
                solutions.editable ? undefined : t(takenDown ? "takenDown" : "empty.member")
              }
            />
          </div>
        ) : (
          <DataTableRows
            surface
            sortKeys={sorted.sortKeys}
            defaultSort={sorted.defaultSort}
            columns={[
              { id: "solution", header: t("columns.solution"), layout: { fill: true } },
              { id: "status", header: t("columns.status"), layout: { width: "md" } },
              { id: "listing", header: t("columns.listing"), layout: { width: "md" } },
              {
                id: "updated",
                header: t("columns.updated"),
                layout: { width: "md", descFirst: true },
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
                solution: row.name,
                status: row.status,
                listing: row.listing,
                updated: row.updated,
                actions: <div className="flex justify-end">{row.actions}</div>,
              },
            }))}
          />
        )}
      </OrganizationSection>
      <OrganizationOffers offers={offers} editable={solutions.editable} />
    </OrganizationFrame>
  );
}

export { OrganizationSolutionsPage };
