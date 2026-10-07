"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { ReviewReadiness } from "@/components/composites/review-readiness";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { useVocabulary } from "@/i18n/vocabulary";
import type { CustomerDeployment } from "@/lib/api/generated";

import {
  fieldId,
  reviewFields,
  type EditorStep,
  type ReviewField,
  type SolutionDraft,
} from "./solution-editor-state";

type Row = {
  label: string;
  /** What the solution says, or nothing when it says nothing. */
  value: string;
  /** The field a review needs, when this row shows one. */
  needed?: ReviewField;
};

type ReviewGroupProps = {
  title: string;
  rows: Row[];
  missing: ReviewField[];
  onEdit: () => void;
};

/** One step of the editor as the review reads it back: its answers, and what is still missing. */
function ReviewGroup({ title, rows, missing, onEdit }: ReviewGroupProps) {
  const t = useTranslations("Solution.editor.review");
  const lacking = rows.filter((row) => row.needed && missing.includes(row.needed)).length;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-background p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {lacking > 0 && (
            <span className="text-xs font-medium text-destructive">
              {t("toAdd", { count: lacking })}
            </span>
          )}
        </div>
        <TextButton onClick={onEdit} aria-label={t("editStep", { step: title })}>
          <PencilIcon aria-hidden="true" />
          {t("edit")}
        </TextButton>
      </div>
      <dl className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="text-sm text-muted-foreground sm:w-44 sm:shrink-0">{row.label}</dt>
            {row.value ? (
              <dd className="min-w-0 text-sm wrap-break-word whitespace-pre-line">{row.value}</dd>
            ) : row.needed && missing.includes(row.needed) ? (
              <dd className="text-sm font-medium text-destructive">{t("missing")}</dd>
            ) : (
              <dd className="text-sm text-muted-foreground">{t("notPublished")}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

type ReviewStepProps = {
  draft: SolutionDraft;
  change: (patch: Partial<SolutionDraft>) => void;
  customerDeployments: CustomerDeployment[];
  /** The fields a review needs and the draft lacks. */
  missing: ReviewField[];
  /** True when the solution can be sent for review from here; a list of what it lacks then leads. */
  submittable: boolean;
  /** Opens a step, with the focus on one of its fields when one is named. */
  onOpen: (step: EditorStep, field?: string) => void;
};

/** Step 4: everything the solution says, read back by step, and whether the directory lists it. */
function ReviewStep({
  draft,
  change,
  customerDeployments,
  missing,
  submittable,
  onOpen,
}: ReviewStepProps) {
  const t = useTranslations("Solution.editor");
  const maturity = useVocabulary("maturity");
  const industry = useVocabulary("industry");
  const focusArea = useVocabulary("focusArea");
  const language = useVocabulary("language");
  const deployment = useVocabulary("deployment");

  const counted = (state: CustomerDeployment["status"]) =>
    customerDeployments.filter((item) => item.status === state).length;
  const deploymentCounts = (
    [
      ["deploymentsApproved", counted("approved")],
      ["deploymentsWaiting", counted("in_review")],
      ["deploymentsSentBack", counted("rejected")],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([key, count]) => t(`review.${key}`, { count }))
    .join(" · ");

  const groups: { step: EditorStep; rows: Row[] }[] = [
    {
      step: "basics",
      rows: [
        { label: t("fields.name"), value: draft.name.trim(), needed: "name" },
        { label: t("fields.summary"), value: draft.summary.trim(), needed: "summary" },
        { label: t("fields.problemsSolved"), value: draft.problemsSolved.trim() },
        { label: t("fields.valueProposition"), value: draft.valueProposition.trim() },
        {
          label: t("fields.maturity"),
          value: draft.maturity && maturity(draft.maturity),
          needed: "maturity",
        },
        { label: t("fields.traction"), value: draft.traction.trim() },
        { label: t("fields.builtWith"), value: draft.builtWith.join(", ") },
      ],
    },
    {
      step: "fit",
      rows: [
        {
          label: t("fields.industries"),
          value: draft.industries.map(industry).join(", "),
          needed: "industries",
        },
        {
          label: t("fields.focusAreas"),
          value: draft.focusAreas.map(focusArea).join(", "),
          needed: "focusAreas",
        },
        { label: t("fields.languages"), value: draft.languages.map(language).join(", ") },
        { label: t("fields.deployment"), value: draft.deployment.map(deployment).join(", ") },
        { label: t("fields.channels"), value: draft.channels.trim() },
        { label: t("fields.bestCustomerProfile"), value: draft.bestCustomerProfile.trim() },
      ],
    },
    {
      step: "evidence",
      rows: [
        { label: t("fields.logo"), value: draft.logo?.fileName ?? "", needed: "logo" },
        { label: t("fields.cover"), value: draft.cover?.fileName ?? "", needed: "cover" },
        {
          label: t("fields.images"),
          value: draft.images.length > 0 ? t("review.images", { count: draft.images.length }) : "",
        },
        { label: t("fields.deck"), value: draft.deck?.fileName ?? "" },
        { label: t("fields.demoUrl"), value: draft.demoUrl.trim() },
        { label: t("fields.website"), value: draft.website.trim() },
        { label: t("review.customerDeployments"), value: deploymentCounts },
      ],
    },
  ];

  return (
    <>
      {submittable && (
        <ReviewReadiness
          missingTitle={t("review.readiness.missing")}
          readyTitle={t("review.readiness.ready")}
          note={t("review.readiness.note")}
          missing={missing.map((field) => ({
            id: fieldId(field),
            label: t(`fields.${field}`),
          }))}
          refused={false}
          onSelect={(id) => {
            const entry = reviewFields.find((candidate) => fieldId(candidate.field) === id);
            if (entry) {
              onOpen(entry.step, id);
            }
          }}
        />
      )}
      {groups.map((group) => (
        <ReviewGroup
          key={group.step}
          title={t(`steps.${group.step}.title`)}
          rows={group.rows}
          missing={missing}
          onEdit={() => onOpen(group.step)}
        />
      ))}
      <Field orientation="horizontal">
        <Checkbox
          id={fieldId("listed")}
          checked={draft.listed}
          onCheckedChange={(checked) => change({ listed: checked === true })}
        />
        <FieldLabel htmlFor={fieldId("listed")}>
          <span className="font-normal">{t("review.listed")}</span>
        </FieldLabel>
      </Field>
    </>
  );
}

export { ReviewStep };
