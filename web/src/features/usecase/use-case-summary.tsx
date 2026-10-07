import { PencilIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { useVocabulary } from "@/i18n/vocabulary";

import { timelinePresets } from "./admin-use-case-codes";
import { budgetFigures, budgetText } from "./use-case-budget";
import { type DraftValues, type Step, timelineOf } from "./use-case-draft";

type FieldKey =
  | "title"
  | "problemStatement"
  | "industry"
  | "technologies"
  | "expectedOutcomes"
  | "currentProcess"
  | "currentSolutions"
  | "targetUsers"
  | "requirements"
  | "dataReadiness"
  | "integration"
  | "attachments"
  | "budget"
  | "timeline"
  | "closes"
  | "companyName";

type TimelineCode = keyof typeof timelinePresets;

type UseCaseSummaryProps = {
  values: DraftValues;
  /** Opens a step; without it the summary only reads. */
  onEdit?: (step: Step) => void;
  /** What the link of a section says when it only shows the step and does not edit it. */
  viewLabel?: string;
};

/**
 * What a use case says, section by section, as the review step of the wizard and the page of a use case
 * that can no longer be changed show it. A section that lacks something says so rather than staying blank.
 */
function UseCaseSummary({ values, onEdit, viewLabel }: UseCaseSummaryProps) {
  const t = useTranslations("Organization.useCases.wizard");
  const r = useTranslations("Organization.useCases.review");
  const industryName = useVocabulary("industry");
  const technologyName = useVocabulary("technology");
  const format = useFormatter();

  const written = (text: string) => (text.trim() === "" ? <Missing /> : text);
  const required = values.requirements.filter(
    (requirement) => requirement.statement.trim() !== "" && requirement.necessity === "required",
  ).length;
  const optional = values.requirements.filter(
    (requirement) => requirement.statement.trim() !== "" && requirement.necessity === "optional",
  ).length;
  const timeline = timelineOf(values);
  const locale = useLocale();

  const blocks: {
    step: Step;
    rows: { key: FieldKey; value: React.ReactNode }[];
  }[] = [
    {
      step: "challenge",
      rows: [
        { key: "title", value: written(values.title) },
        { key: "problemStatement", value: written(values.problemStatement) },
        { key: "industry", value: values.industry ? industryName(values.industry) : <Missing /> },
        {
          key: "technologies",
          value:
            values.technologies.length > 0 ? (
              values.technologies.map(technologyName).join(", ")
            ) : (
              <Missing />
            ),
        },
      ],
    },
    {
      step: "outcomes",
      rows: [
        { key: "expectedOutcomes", value: written(values.expectedOutcomes) },
        { key: "currentProcess", value: written(values.currentProcess) },
        ...(values.currentSolutions.trim() === ""
          ? []
          : [{ key: "currentSolutions" as const, value: values.currentSolutions }]),
        { key: "targetUsers", value: written(values.targetUsers) },
      ],
    },
    {
      step: "requirements",
      rows: [
        {
          key: "requirements",
          value:
            required + optional > 0 ? (
              r("requirementsCount", { total: required + optional, required, optional })
            ) : (
              <Missing />
            ),
        },
        { key: "dataReadiness", value: written(values.dataReadiness) },
        { key: "integration", value: written(values.integrationRequirements) },
        ...(values.attachments.length === 0
          ? []
          : [
              {
                key: "attachments" as const,
                value: values.attachments.map((file) => file.fileName).join(", "),
              },
            ]),
      ],
    },
    {
      step: "budget",
      rows: [
        {
          key: "budget",
          value: values.budgetToBeDetermined ? (
            r("budgetTbd")
          ) : values.budgetMin !== "" && values.budgetMax !== "" ? (
            budgetText(
              budgetFigures(
                Number(values.budgetMin),
                Number(values.budgetMax),
                values.currency,
                locale,
              ),
              (key, figures) => r(key === "single" ? "budgetSingle" : "budgetRange", figures),
            )
          ) : (
            <Missing />
          ),
        },
        {
          key: "timeline",
          value: timeline ? t(`timeline.${timeline as TimelineCode}`) : <Missing />,
        },
        {
          key: "closes",
          value: values.closesDay ? (
            r("closesAt", {
              date: format.dateTime(new Date(`${values.closesDay}T00:00:00+07:00`), {
                dateStyle: "medium",
                timeZone: "Asia/Ho_Chi_Minh",
              }),
              time: values.closesTime,
            })
          ) : (
            <Missing />
          ),
        },
        {
          key: "companyName",
          value: r(values.hideOrganizationName ? "companyHidden" : "companyShown"),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block) => (
        <section
          key={block.step}
          aria-labelledby={`summary-${block.step}`}
          className="flex flex-col gap-3 rounded-xl border p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id={`summary-${block.step}`} className="text-base font-medium">
              {t(`steps.${block.step}.title`)}
            </h3>
            {onEdit && (
              <TextButton onClick={() => onEdit(block.step)}>
                {!viewLabel && <PencilIcon aria-hidden="true" />}
                {viewLabel ?? r("edit")}
              </TextButton>
            )}
          </div>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {block.rows.map((row) => (
              <div key={row.key} className="contents">
                <dt className="text-muted-foreground">{r(`field.${row.key}`)}</dt>
                <dd className="break-words whitespace-pre-line sm:col-span-2">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Missing() {
  const r = useTranslations("Organization.useCases.review");
  return <span className="text-muted-foreground italic">{r("missing")}</span>;
}

export { UseCaseSummary };
