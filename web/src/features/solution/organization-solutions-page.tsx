import { BoxesIcon, EllipsisIcon, ExternalLinkIcon, PencilIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ReviewStatus } from "@/components/composites/review-status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrganizationFrame } from "@/features/organization/organization-frame";
import { OrganizationSection } from "@/features/organization/organization-section";
import { Link } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import type {
  MyOrganization,
  MySolutions,
  Organization,
  SolutionSummary,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CreateSolution } from "./create-solution";

type OrganizationSolutionsPageProps = {
  mine: MyOrganization & { organization: Organization };
  solutions: MySolutions;
  /** How many members the organization has, for the tab beside this one. */
  members: number;
};

/** The states a solution is counted under, in the order the summary says them. */
const states = ["listed", "draft", "submitted", "rejected", "hidden"] as const;

/** Where a solution stands for the people of its organization: listed, hidden, or not public yet. */
function stateOf(solution: SolutionSummary): (typeof states)[number] {
  if (solution.status !== "approved") {
    return solution.status;
  }
  return solution.listed ? "listed" : "hidden";
}

/**
 * My organization › Solutions: what the organization offers, each with where its review stands.
 * Owners of an approved provider add and change them; members read.
 */
function OrganizationSolutionsPage({ mine, solutions, members }: OrganizationSolutionsPageProps) {
  const t = useTranslations("Solution.mine");
  const status = useVocabulary("reviewStatus");
  const format = useFormatter();
  const waiting = mine.role === "owner" && mine.organization.status !== "approved";

  const rows = solutions.items.map((solution) => {
    const editor = `${siteRoutes.workspaceSolutions}/${solution.id}`;
    const state = stateOf(solution);
    return {
      id: solution.id,
      name: (
        <div className="grid min-w-0 text-sm">
          <Link
            href={editor}
            className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {solution.name}
          </Link>
          <span className="truncate text-muted-foreground">{t(`state.${state}`)}</span>
        </div>
      ),
      status: <ReviewStatus state={solution.status}>{status(solution.status)}</ReviewStatus>,
      updated: (
        <span className="text-muted-foreground">
          {format.dateTime(new Date(solution.updatedAt), { dateStyle: "medium" })}
        </span>
      ),
      actions: (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={t("actions.open", { name: solution.name })}
                className="hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
              />
            }
          >
            <EllipsisIcon className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={editor} />}>
                <PencilIcon aria-hidden="true" />
                {t(solutions.editable ? "actions.edit" : "actions.view")}
              </DropdownMenuItem>
              {state === "listed" && (
                <DropdownMenuItem
                  render={<Link href={`${siteRoutes.solutions}/${solution.slug}`} />}
                >
                  <ExternalLinkIcon aria-hidden="true" />
                  {t("actions.viewPublic")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    };
  });

  const count = (state: (typeof states)[number]) =>
    solutions.items.filter((solution) => stateOf(solution) === state).length;
  const summary = states
    // What is listed is always said; the other states only when a solution is in them.
    .filter((state) => state === "listed" || count(state) > 0)
    .map((state) => t(`summary.${state}`, { count: count(state) }))
    .join(" · ");

  return (
    <OrganizationFrame
      mine={mine}
      current="solutions"
      counts={{ members, solutions: solutions.items.length }}
    >
      <OrganizationSection
        id="solutions-list"
        title={t("title")}
        summary={rows.length > 0 ? summary : undefined}
        action={solutions.editable && <CreateSolution />}
      >
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-background">
            <DataTableEmpty
              icon={<BoxesIcon aria-hidden="true" />}
              title={t("empty.title")}
              description={t(
                solutions.editable ? "empty.owner" : waiting ? "afterApproval" : "empty.member",
              )}
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
                  <TableHead className="w-32">{t("columns.updated")}</TableHead>
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
