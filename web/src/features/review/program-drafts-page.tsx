import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { useFormatter } from "@/i18n/format";
import { useCountryName } from "@/i18n/vocabulary";
import type { ProgramDrafts, ReviewApplications } from "@/lib/api/generated";
import { Link } from "@/i18n/navigation";
import {
  adminProgramApplicationsRoute,
  adminProgramDraftRoute,
  adminProgramDraftsRoute,
} from "@/lib/site";

import { ExportDrafts } from "./export-drafts";
import { listApplications } from "./review-search";
import { ReviewTabs } from "./review-toolbar";

/**
 * Admin › Programs › a program › Applications › Drafts: the applications not submitted yet, the most
 * recently saved first, for GenAI Fund to remind their applicants before the close. Each row says
 * who started it, how to reach them and how far they got; what a draft says stays the applicant's,
 * so its answers, deck and solution are not shown. Judges never reach this page.
 */
function ProgramDraftsPage({
  applications,
  drafts,
  tabs,
}: {
  applications: ReviewApplications;
  drafts: ProgramDrafts;
  tabs: React.ReactNode;
}) {
  const t = useTranslations("Review.drafts");
  const { head } = applications;
  // The list's tabs count as the list would open, with no search or filter.
  const { counts } = listApplications(
    applications.items,
    { tab: "all", q: "", choice: null, kind: null, sort: "", page: 1 },
    head.operator,
  );
  const format = useFormatter();
  const country = useCountryName();
  const time = (at: string) =>
    format.dateTime(new Date(at), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  const total = drafts.requiredQuestions > 0 ? 4 : 3;

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        title={head.name}
        back={{ href: adminProgramApplicationsRoute(head.programId), label: t("back") }}
        lead={t("lead", { count: drafts.items.length })}
        actions={
          <ExportDrafts
            programId={head.programId}
            slug={head.slug}
            disabled={drafts.items.length === 0}
          />
        }
      >
        {tabs}
      </AdminPageHeader>
      <ReviewTabs
        operator={head.operator}
        counts={counts}
        drafts={{ count: drafts.items.length, href: adminProgramDraftsRoute(head.programId) }}
        current="drafts"
        base={adminProgramApplicationsRoute(head.programId)}
      />
      {drafts.items.length > 0 ? (
        <DataTableRows
          rowLinks
          caption={t("caption")}
          columns={[
            { id: "applicant", header: t("columns.applicant") },
            { id: "phone", header: t("columns.phone") },
            { id: "organization", header: t("columns.organization"), layout: { from: "lg" } },
            { id: "progress", header: t("columns.progress") },
            { id: "saved", header: t("columns.saved"), layout: { width: "md" } },
          ]}
          rows={drafts.items.map((draft) => {
            const name = [draft.firstName, draft.lastName].filter(Boolean).join(" ");
            // The four steps of the form, the questions only when the program asks any required.
            const steps: { key: "contact" | "solution" | "deck" | "questions"; done: boolean }[] = [
              { key: "contact", done: draft.contactComplete },
              { key: "solution", done: draft.solutionChosen },
              { key: "deck", done: draft.deckAttached },
              ...(drafts.requiredQuestions > 0
                ? [
                    {
                      key: "questions" as const,
                      done: draft.requiredAnswered >= drafts.requiredQuestions,
                    },
                  ]
                : []),
            ];
            const missing = steps
              .filter((step) => !step.done)
              .map((step) => t(`steps.${step.key}`));
            return {
              id: draft.id,
              cells: {
                applicant: (
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {/* The name is the row's link; a press anywhere on the row follows it. */}
                    <Link
                      href={adminProgramDraftRoute(head.programId, draft.id)}
                      className="rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {name || t("noName")}
                    </Link>
                    <a
                      href={`mailto:${draft.email}`}
                      className="truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {draft.email}
                    </a>
                  </div>
                ),
                phone: draft.phone ? (
                  <span className="flex flex-col gap-0.5">
                    <a
                      href={`tel:${draft.phone.replace(/[^+\d]/g, "")}`}
                      className="whitespace-nowrap underline-offset-4 hover:underline"
                    >
                      {draft.phone}
                    </a>
                    {draft.country && (
                      <span className="text-xs text-muted-foreground">
                        {country(draft.country)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t("none")}</span>
                ),
                organization: draft.organizationName ?? (
                  <span className="text-muted-foreground">{t("none")}</span>
                ),
                progress: (
                  <div className="flex flex-col gap-0.5">
                    <span>{t("progress", { done: total - missing.length, total })}</span>
                    {missing.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t("missing", { steps: format.list(missing) })}
                      </span>
                    )}
                  </div>
                ),
                saved: (
                  <time
                    dateTime={draft.lastSavedAt}
                    className="whitespace-nowrap text-muted-foreground"
                  >
                    {time(draft.lastSavedAt)}
                  </time>
                ),
              },
            };
          })}
        />
      ) : (
        <DataTableEmpty
          icon={<FileTextIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}
    </div>
  );
}

export { ProgramDraftsPage };
