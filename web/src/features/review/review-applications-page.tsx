import { CircleCheckIcon, FileTextIcon, SearchXIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty, DataTableFooter } from "@/components/composites/data-table";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { applyFormatter } from "@/features/apply/apply-format";
import { programFormatter } from "@/features/program/program-format";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { ReviewApplicationItem, ReviewApplications } from "@/lib/api/generated";
import { adminProgramReleaseRoute } from "@/lib/site";

import { ExportApplications } from "./export-applications";
import { listApplications, reviewSearch, type ReviewSearch } from "./review-search";
import { PageLeadingAction, ReviewSelection } from "./review-selection";
import { ReviewTable, type ReviewRow } from "./review-table";
import { ReviewToolbar } from "./review-toolbar";

const address = createSerializer(reviewSearch);

type ReviewApplicationsPageProps = {
  data: ReviewApplications;
  search: ReviewSearch;
  /** Where this list is: an application opens under it. */
  base: string;
  /** The program's tabs in the admin area; a judge has none. */
  tabs?: React.ReactNode;
};

/**
 * A program's submitted applications to review, sorted by a column header and paged. An operator
 * reads GenAI Fund's decisions and every judge's average, the highest first once any is scored, and
 * decides on several at once; a judge reads their own scores, the earliest submitted first. Drafts
 * and withdrawn applications are counted under the list, never listed. An operator downloads the
 * applications the search matches, and reads under the list how many have a score.
 */
function ReviewApplicationsPage({ data, search, base, tabs }: ReviewApplicationsPageProps) {
  const t = useTranslations("Review.list");
  const pages = useTranslations("Lists.pagination");
  const locale = useLocale();
  const type = useVocabulary("organizationType");
  const country = useCountryName();
  const format = applyFormatter(locale);
  const dates = programFormatter(locale);
  /** "3 Oct", the day of an instant in Vietnam time. */
  const day = (at: string) => dates.dateTime(new Date(at), "day");
  const { head } = data;
  const list = listApplications(data.items, search, head.operator);
  const { ordered: shown, counts } = list;

  function status(item: ReviewApplicationItem): ReviewRow["status"] {
    if (item.own && !head.operator) {
      return { label: t("own"), variant: "outline" };
    }
    if (head.operator) {
      const decision = item.reviewStatus ?? "under_review";
      return {
        label: t(`decision.${decision}`),
        variant:
          decision === "shortlisted"
            ? "success"
            : decision === "not_selected"
              ? "outline"
              : "warning",
      };
    }
    if (item.mine === "conflict") {
      return { label: t("mine.conflict"), variant: "outline" };
    }
    return item.average == null
      ? { label: t("mine.none"), variant: "outline" }
      : { label: t("average", { value: item.average.toFixed(1) }), variant: "info" };
  }

  const rows: ReviewRow[] = list.rows.map((item) => ({
    id: item.id,
    href: `${base}/${item.id}`,
    solution: item.solutionName,
    applicant: [
      item.organizationName,
      type(item.organizationType),
      item.country && country(item.country),
    ]
      .filter(Boolean)
      .join(" · "),
    choice: item.choice ?? null,
    submitted: `${day(item.submittedAt)}, ${format.time(item.submittedAt)}`,
    scores: head.operator
      ? item.average == null
        ? t("scored", { count: item.scored ?? 0 })
        : t("scoredAverage", { count: item.scored ?? 0, value: item.average.toFixed(1) })
      : null,
    status: status(item),
    own: item.own,
  }));

  const narrowed =
    search.q.trim() !== "" ||
    search.choice !== null ||
    search.kind !== null ||
    search.tab !== "all";
  // A judge with nothing left to score has finished, whatever the search: not a search that failed.
  const allScored =
    !head.operator && search.tab === "to_score" && counts.to_score === 0 && counts.scored > 0;
  const lead = head.releasedAt
    ? t("lead.released", { day: day(head.releasedAt) })
    : !head.closed
      ? t("lead.open", { closes: format.deadline(head.closesAt) })
      : head.outcomesDueOn
        ? t("lead.closed", { day: format.day(head.outcomesDueOn) })
        : t("lead.closedNoDay");

  return (
    <ReviewSelection
      className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8"
      lang={locale}
    >
      <AdminPageHeader
        title={head.name}
        lead={head.operator ? lead : t("judgeLead", { count: head.criteria.length })}
        actions={
          head.operator && (
            <>
              <ExportApplications
                programId={head.programId}
                slug={head.slug}
                applicationIds={narrowed ? shown.map((item) => item.id) : null}
                disabled={shown.length === 0}
              />
              {head.releasedAt ? (
                <Button prominence="secondary" href={adminProgramReleaseRoute(head.programId)}>
                  {t("seeRelease")}
                </Button>
              ) : (
                // While rows are selected the selection bar's Shortlist is the screen's primary.
                <PageLeadingAction href={adminProgramReleaseRoute(head.programId)}>
                  {t("release")}
                </PageLeadingAction>
              )}
            </>
          )
        }
      >
        {tabs}
      </AdminPageHeader>
      {head.criteria.length === 0 && (
        <p className="rounded-lg border bg-muted p-3 text-sm">
          {head.operator ? t("noCriteria.operator") : t("noCriteria.judge")}
        </p>
      )}
      <ReviewToolbar
        operator={head.operator}
        counts={counts}
        choice={head.choice ? { label: head.choice.label, options: head.choice.options } : null}
      />
      {rows.length > 0 ? (
        <ReviewTable
          programId={head.programId}
          rows={rows}
          matching={shown.filter((item) => !item.own).map((item) => item.id)}
          sortKeys={list.sortKeys}
          defaultSort={list.defaultSort}
          choiceLabel={head.choice?.label ?? null}
          operator={head.operator}
          released={Boolean(head.releasedAt)}
        />
      ) : allScored ? (
        <DataTableEmpty icon={<CircleCheckIcon aria-hidden="true" />} title={t("allScored.title")}>
          <Button prominence="secondary" size="sm" href={`${base}${address({ tab: "scored" })}`}>
            {t("allScored.see")}
          </Button>
        </DataTableEmpty>
      ) : narrowed && data.items.length > 0 ? (
        <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
          <Button prominence="secondary" size="sm" href={base}>
            {t("noMatch.clear")}
          </Button>
        </DataTableEmpty>
      ) : (
        <DataTableEmpty
          icon={<FileTextIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}
      <DataTableFooter
        count={[
          t("footer", { shown: shown.length, drafts: data.drafts, withdrawn: data.withdrawn }),
          ...(head.operator && data.items.length > 0
            ? [
                t("footerScored", {
                  scored: data.items.filter((item) => (item.scored ?? 0) > 0).length,
                  total: data.items.length,
                }),
              ]
            : []),
        ].join(" · ")}
        page={list.page}
        pages={list.pages}
        href={(number) => `${base}${address({ ...search, page: number })}`}
        labels={{
          navigation: pages("label"),
          previous: pages("previous"),
          next: pages("next"),
          goToPrevious: pages("goToPrevious"),
          goToNext: pages("goToNext"),
          page: (number) => pages("page", { page: number }),
        }}
      />
    </ReviewSelection>
  );
}

export { ReviewApplicationsPage };
