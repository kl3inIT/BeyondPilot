"use client";

import { useStore } from "@tanstack/react-form";
import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { ReviewReadiness } from "@/components/composites/review-readiness";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useVocabulary } from "@/i18n/vocabulary";
import type { CustomerDeployment, PublicSolutionSummary } from "@/lib/api/generated";

import { SolutionCard } from "./solution-card";
import { SolutionDeckPreview } from "./solution-deck-preview";
import { fieldId, reviewFields, type EditorStep, type ReviewField } from "./solution-editor-state";
import { SolutionRecordImages } from "./solution-record-images";
import type { SolutionForm } from "./solution-editor-form";

type Row = {
  label: string;
  /** What the solution says, or nothing when it says nothing. */
  value: React.ReactNode;
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
  /** The editor's form: the review reads the draft it holds, and holds whether it is listed. */
  form: SolutionForm;
  /** Null where an operator writes the solution: the organization adds the projects, and this reads none. */
  customerDeployments: CustomerDeployment[] | null;
  /** True on the operators' page, where the last step publishes at once instead of asking for a review. */
  operator: boolean;
  /** The fields a review needs and the draft lacks. */
  missing: ReviewField[];
  /** True when the solution can be sent for review from here; a list of what it lacks then leads. */
  submittable: boolean;
  /** The organization the card names, and the address the solution would have. */
  organizationName: string;
  slug: string;
  deckHref: string | undefined;
  /** Whether the person said that what they wrote is right; asked for when it is sent from here. */
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  /** Opens a step, with the focus on one of its fields when one is named. */
  onOpen: (step: EditorStep, field?: string) => void;
};

/** Step 4: everything the solution says, read back by step, and whether the directory lists it. */
function ReviewStep({
  form,
  customerDeployments,
  operator,
  missing,
  submittable,
  organizationName,
  slug,
  deckHref,
  confirmed,
  onConfirmedChange,
  onOpen,
}: ReviewStepProps) {
  const t = useTranslations("Solution.editor");
  const maturity = useVocabulary("maturity");
  const industry = useVocabulary("industry");
  const focusArea = useVocabulary("focusArea");
  const language = useVocabulary("language");
  const deployment = useVocabulary("deployment");
  const draft = useStore(form.store, (state) => state.values.solution);
  const imagePreview = (image: typeof draft.logo, caption: string, shape: "square" | "wide") =>
    image ? (
      <SolutionRecordImages
        name={draft.name}
        images={[
          {
            fileId: image.fileId,
            caption,
            label: t("images.previewNamed", { name: image.fileName }),
            shape,
          },
        ]}
      />
    ) : null;

  const counted = (state: CustomerDeployment["status"]) =>
    (customerDeployments ?? []).filter((item) => item.status === state).length;
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

  // The card the directory would draw from what the editor holds, so images are seen before a review.
  const preview: PublicSolutionSummary = {
    name: draft.name.trim(),
    slug,
    summary: draft.summary.trim() || null,
    organizationName,
    organizationSlug: "",
    coverFileId: draft.cover?.fileId ?? null,
    logoFileId: draft.logo?.fileId ?? null,
    focusAreas: draft.focusAreas,
    industries: draft.industries,
    customerDeployments: counted("approved"),
    featured: false,
    backing: null,
    offers: draft.offers.map(({ title, url, fromGenAiFund }) => ({ title, url, fromGenAiFund })),
  };

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
        { label: t("fields.offers"), value: draft.offers.map((offer) => offer.title).join("\n") },
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
        {
          label: t("fields.logo"),
          value: imagePreview(draft.logo, t("fields.logo"), "square"),
          needed: "logo",
        },
        {
          label: t("fields.cover"),
          value: imagePreview(draft.cover, t("fields.cover"), "wide"),
          needed: "cover",
        },
        {
          label: t("fields.images"),
          value:
            draft.images.length > 0 ? (
              <SolutionRecordImages
                name={draft.name}
                images={draft.images.map((image, index) => ({
                  fileId: image.fileId,
                  caption: String(index + 1),
                  label: t("images.previewNamed", { name: image.fileName }),
                  shape: "square",
                }))}
              />
            ) : (
              ""
            ),
        },
        {
          label: t("fields.deck"),
          value: draft.deck ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all">{draft.deck.fileName}</span>
              <SolutionDeckPreview
                fileName={draft.deck.fileName}
                fileUrl={deckHref ?? draft.deck.previewUrl}
              />
            </div>
          ) : (
            ""
          ),
        },
        { label: t("fields.demoUrl"), value: draft.demoUrl.trim() },
        { label: t("fields.website"), value: draft.website.trim() },
        ...(customerDeployments
          ? [{ label: t("review.customerDeployments"), value: deploymentCounts }]
          : []),
      ],
    },
  ];

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">{t("review.preview.title")}</h2>
          {!draft.listed && (
            <p className="text-sm text-muted-foreground">{t("review.preview.unlisted")}</p>
          )}
        </div>
        {/* A picture of the card: its links lead nowhere before the solution is approved. */}
        <div inert className="pointer-events-none flex max-w-100">
          <SolutionCard solution={preview} />
        </div>
      </section>
      {submittable && (
        <ReviewReadiness
          missingTitle={t(
            operator ? "review.readiness.missingOperator" : "review.readiness.missing",
          )}
          readyTitle={t(operator ? "review.readiness.readyOperator" : "review.readiness.ready")}
          note={t(operator ? "review.readiness.noteOperator" : "review.readiness.note")}
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
      <form.Field name="solution.listed">
        {(field) => (
          <Field orientation="horizontal">
            <Checkbox
              id={fieldId("listed")}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked === true)}
              aria-describedby={`${fieldId("listed")}-hint`}
            />
            <FieldContent>
              <FieldLabel htmlFor={fieldId("listed")}>
                <span className="font-normal">{t("review.listed")}</span>
              </FieldLabel>
              <FieldDescription id={`${fieldId("listed")}-hint`}>
                {t("review.listedHint")}
              </FieldDescription>
            </FieldContent>
          </Field>
        )}
      </form.Field>
      {submittable && (
        <Field orientation="horizontal">
          <Checkbox
            id={fieldId("confirmed")}
            checked={confirmed}
            onCheckedChange={(checked) => onConfirmedChange(checked === true)}
            required
          />
          <FieldContent>
            <FieldLabel htmlFor={fieldId("confirmed")}>
              <span className="font-normal">{t("review.confirmAccurate")}</span>
            </FieldLabel>
          </FieldContent>
        </Field>
      )}
    </>
  );
}

export { ReviewStep };
