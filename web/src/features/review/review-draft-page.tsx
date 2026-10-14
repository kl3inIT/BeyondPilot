import { useLocale, useTranslations } from "next-intl";

import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { applyFormatter } from "@/features/apply/apply-format";
import type { ReviewDraft } from "@/lib/api/generated";
import { adminProgramDraftsRoute } from "@/lib/site";

import { SubmittedRecord } from "./submitted-record";

/**
 * One application not submitted yet, as it stands now, for an operator to see who may yet apply.
 * It reads as a submission does, in the blocks of the form; a part not written yet says so. It is
 * not reviewed: judges never see it, and opening it is recorded.
 */
function ReviewDraftPage({ draft }: { draft: ReviewDraft }) {
  const t = useTranslations("Review.drafts.detail");
  const format = applyFormatter(useLocale());
  const { head } = draft;
  const contact = draft.draft.contact;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || draft.draft.email;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        title={name}
        back={{ href: adminProgramDraftsRoute(head.programId), label: t("back") }}
        lead={t("lead", {
          program: head.name,
          started: format.moment(draft.startedAt),
          saved: format.moment(draft.lastSavedAt),
        })}
      />
      <p className="rounded-lg border bg-muted p-3 text-sm">{t("note")}</p>
      <div className="min-w-0 lg:max-w-3xl">
        <SubmittedRecord applicationId={draft.id} submitted={draft.draft} draft />
      </div>
    </div>
  );
}

export { ReviewDraftPage };
