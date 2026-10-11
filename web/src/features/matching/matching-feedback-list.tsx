import { getFormatter, getTranslations } from "next-intl/server";

import { TextButton } from "@/components/actions/text-button";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { DataTableFooter } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import type { MatchingDisagreement, MatchingFeedbackList } from "@/lib/api/generated";
import { adminUseCaseCandidatesRoute, siteRoutes } from "@/lib/site";

import { MatchingAdminTabs } from "./matching-admin-tabs";
import { matchingFeedbackAddress } from "./matching-search";
import { requirementName } from "./matching-view";
import { PageSizeSelect } from "@/components/composites/page-size-select";

/**
 * Admin › AI › Matching, the Feedback tab: what people said about the groups the AI gave. How many
 * answered in the last 30 days and how many of them agreed, then each answer that says a group is
 * wrong, newest first, with a link to the solution among those matched to its use case. A table from
 * 768px, one stacked row an answer below that. The page of the list is the URL.
 */
async function MatchingFeedbackPage({
  feedback,
  size,
}: {
  feedback: MatchingFeedbackList;
  /** The page size the URL holds; none is the list's own. */
  size: number | null;
}) {
  const [t, title, word, format] = await Promise.all([
    getTranslations("Admin.matching.feedback"),
    getTranslations("Admin.matching"),
    getTranslations("Matching"),
    getFormatter(),
  ]);
  const groupName = (bucket: MatchingDisagreement["aiBucket"]) =>
    bucket === "none" ? word("feedback.none") : word(`groups.${bucket}.title`);

  const rows = feedback.items.map((item) => {
    const solution = item.solutionName ?? "—";
    return {
      key: item.id,
      // The solution opens among those matched to its use case, which only a published use case has.
      solution: item.useCaseTitle ? (
        <TextButton
          href={`${adminUseCaseCandidatesRoute(item.useCaseId)}?solution=${item.candidateId}`}
        >
          {solution}
        </TextButton>
      ) : (
        <span className="font-medium">{solution}</span>
      ),
      useCase: item.useCaseTitle ?? "—",
      ai: groupName(item.aiBucket),
      expected: groupName(item.expectedBucket),
      // A requirement of an earlier judgment is no longer kept: it is named by its place alone.
      requirements: format.list(
        item.requirements.map((one) =>
          one.statement
            ? requirementName({ label: one.label ?? "", statement: one.statement })
            : t("requirement", { position: one.position }),
        ),
        { type: "conjunction", style: "narrow" },
      ),
      note: item.note ?? "",
      by: item.by ?? "—",
      at: item.createdAt,
      when: format.dateTime(new Date(item.createdAt), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }),
    };
  });
  const pages = Math.max(1, Math.ceil(feedback.total / feedback.pageSize));
  const nobody = feedback.answers === 0 && feedback.total === 0;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageTitle destination="aiMatching">{title("title")}</AdminPageTitle>
      <MatchingAdminTabs current="feedback" />
      <p className="text-sm text-muted-foreground">
        {nobody ? t("empty") : t("agreed", { a: feedback.agreements, n: feedback.answers })}
      </p>

      {feedback.total > 0 && (
        <>
          {/* The solution, the requirements and the note wrap; a cell keeps one line otherwise. */}
          <DataTableRows
            className="hidden md:flex"
            columns={[
              { id: "solution", header: t("columns.solution"), layout: { top: true } },
              { id: "ai", header: t("columns.ai"), layout: { top: true } },
              { id: "expected", header: t("columns.expected"), layout: { top: true } },
              { id: "requirements", header: t("columns.requirements"), layout: { top: true } },
              { id: "note", header: t("columns.note"), layout: { top: true } },
              { id: "who", header: t("columns.who") },
            ]}
            rows={rows.map((row) => ({
              id: row.key,
              cells: {
                solution: (
                  <span className="flex flex-col items-start gap-0.5 whitespace-normal">
                    {row.solution}
                    <span className="text-xs text-muted-foreground">{row.useCase}</span>
                  </span>
                ),
                ai: row.ai,
                expected: <span className="font-medium">{row.expected}</span>,
                requirements: <span className="whitespace-normal">{row.requirements}</span>,
                note: <span className="whitespace-normal">{row.note}</span>,
                who: (
                  <span className="flex flex-col">
                    <span>{row.by}</span>
                    <time dateTime={row.at} className="text-xs text-muted-foreground">
                      {row.when}
                    </time>
                  </span>
                ),
              },
            }))}
          />

          <ul
            data-slot="matching-disagreements"
            className="overflow-hidden rounded-lg border md:hidden"
          >
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-col items-start gap-1.5 border-b p-3 text-sm last:border-b-0"
              >
                {row.solution}
                <span className="text-xs text-muted-foreground">{row.useCase}</span>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <dt className="text-xs text-muted-foreground">{t("columns.ai")}</dt>
                  <dt className="text-xs text-muted-foreground">{t("columns.expected")}</dt>
                  <dd>{row.ai}</dd>
                  <dd className="font-medium">{row.expected}</dd>
                </dl>
                {row.requirements && (
                  <p className="wrap-break-word">
                    <span className="text-xs text-muted-foreground">
                      {t("columns.requirements")}:{" "}
                    </span>
                    {row.requirements}
                  </p>
                )}
                {row.note && <p className="wrap-break-word">{row.note}</p>}
                <p className="text-xs text-muted-foreground">
                  {row.by} · <time dateTime={row.at}>{row.when}</time>
                </p>
              </li>
            ))}
          </ul>

          <DataTableFooter
            count={t("count", { count: feedback.total })}
            page={feedback.page}
            pages={pages}
            href={(page) =>
              matchingFeedbackAddress(siteRoutes.adminAiMatchingFeedback, { page, size })
            }
            sizer={<PageSizeSelect size={feedback.pageSize} total={feedback.total} />}
            labels={{
              navigation: t("pagination.label"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              goToPrevious: t("pagination.goToPrevious"),
              goToNext: t("pagination.goToNext"),
              page: (page) => t("pagination.page", { page }),
            }}
          />
        </>
      )}
    </div>
  );
}

export { MatchingFeedbackPage };
