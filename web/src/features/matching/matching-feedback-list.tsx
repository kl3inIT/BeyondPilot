import { getTranslations } from "next-intl/server";

import { TextButton } from "@/components/actions/text-button";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { DataTableRows } from "@/components/composites/data-table-view";
import { getFormatter } from "@/i18n/format-server";
import type { MatchingDisagreement, MatchingFeedbackList } from "@/lib/api/generated";
import { adminUseCaseCandidatesRoute, siteRoutes } from "@/lib/site";
import { momentText } from "@/i18n/formats";

import { MatchingAdminTabs } from "./matching-admin-tabs";
import { matchingFeedbackAddress } from "./matching-search";
import { requirementName } from "./matching-view";
import { ListFooter } from "@/components/composites/list-footer";

/**
 * Admin › AI › Matching, the Feedback tab: what people said about the groups the AI gave. How many
 * answered in the last 30 days and how many of them agreed, then each answer that says a group is
 * wrong, newest first, with a link to the solution among those matched to its use case. The page
 * of the list is the URL.
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
      when: momentText(format, new Date(item.createdAt)),
    };
  });
  const nobody = feedback.answers === 0 && feedback.total === 0;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        destination="aiMatching"
        title={title("title")}
        lead={nobody ? t("empty") : t("agreed", { a: feedback.agreements, n: feedback.answers })}
      >
        <MatchingAdminTabs current="feedback" />
      </AdminPageHeader>

      {feedback.total > 0 && (
        <>
          {/* The solution, the requirements and the note wrap; a cell keeps one line otherwise. */}
          {/* Each keeps a width to wrap in when the table scrolls on a phone. */}
          <DataTableRows
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
                  <span className="flex min-w-40 flex-col items-start gap-0.5 whitespace-normal">
                    {row.solution}
                    <span className="text-xs text-muted-foreground">{row.useCase}</span>
                  </span>
                ),
                ai: row.ai,
                expected: <span className="font-medium">{row.expected}</span>,
                requirements: (
                  <span className="block min-w-48 whitespace-normal">{row.requirements}</span>
                ),
                note: <span className="block min-w-56 whitespace-normal">{row.note}</span>,
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

          <ListFooter
            count={t("count", { count: feedback.total })}
            page={feedback.page}
            pageSize={feedback.pageSize}
            total={feedback.total}
            href={(page) =>
              matchingFeedbackAddress(siteRoutes.adminAiMatchingFeedback, { page, size })
            }
          />
        </>
      )}
    </div>
  );
}

export { MatchingFeedbackPage };
