import { FileTextIcon, SearchXIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { applyFormatter } from "@/features/apply/apply-format";
import { programFormatter } from "@/features/program/program-format";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { ReviewApplicationItem, ReviewApplications } from "@/lib/api/generated";
import { adminProgramReleaseRoute } from "@/lib/site";

import { narrowApplications, type ReviewSearch } from "./review-search";
import { ReviewTable, type ReviewRow } from "./review-table";
import { ReviewToolbar } from "./review-toolbar";

type ReviewApplicationsPageProps = {
  data: ReviewApplications;
  search: ReviewSearch;
  /** Where this list is: an application opens under it. */
  base: string;
  /** The program's tabs in the admin area; a judge has none. */
  tabs?: React.ReactNode;
};

/**
 * A program's submitted applications to review, the earliest first. An operator reads GenAI Fund's
 * decisions and every judge's average and decides on several at once; a judge reads their own
 * scores. Drafts and withdrawn applications are counted under the list, never listed.
 */
function ReviewApplicationsPage({ data, search, base, tabs }: ReviewApplicationsPageProps) {
  const t = useTranslations("Review.list");
  const locale = useLocale();
  const type = useVocabulary("organizationType");
  const country = useCountryName();
  const format = applyFormatter(locale);
  const dates = programFormatter(locale);
  /** "3 Oct", the day of an instant in Vietnam time. */
  const day = (at: string) => dates.dateTime(new Date(at), { day: "numeric", month: "short" });
  const { head } = data;
  const { shown, counts } = narrowApplications(data.items, search);

  function status(item: ReviewApplicationItem): ReviewRow["status"] {
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

  const rows: ReviewRow[] = shown.map((item) => ({
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
  }));

  const narrowed =
    search.q.trim() !== "" ||
    search.choice !== null ||
    search.kind !== null ||
    search.tab !== "all";
  const lead = head.releasedAt
    ? t("lead.released", { day: day(head.releasedAt) })
    : !head.closed
      ? t("lead.open", { closes: format.deadline(head.closesAt) })
      : head.outcomesDueOn
        ? t("lead.closed", { day: format.day(head.outcomesDueOn) })
        : t("lead.closedNoDay");

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{head.name}</h1>
          <p className="text-sm text-muted-foreground">
            {head.operator ? lead : t("judgeLead", { count: head.criteria.length })}
          </p>
        </div>
        {head.operator && (
          <Button
            prominence={head.releasedAt ? "secondary" : "primary"}
            href={adminProgramReleaseRoute(head.programId)}
          >
            {head.releasedAt ? t("seeRelease") : t("release")}
          </Button>
        )}
      </div>
      {tabs}
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
          choiceLabel={head.choice?.label ?? null}
          operator={head.operator}
          released={Boolean(head.releasedAt)}
        />
      ) : narrowed && data.items.length > 0 ? (
        <DataTableEmpty
          icon={<SearchXIcon aria-hidden="true" />}
          title={t("noMatch.title")}
          description={t("noMatch.description")}
        >
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
      <p className="text-sm text-muted-foreground">
        {t("footer", { shown: rows.length, drafts: data.drafts, withdrawn: data.withdrawn })}
      </p>
    </div>
  );
}

export { ReviewApplicationsPage };
