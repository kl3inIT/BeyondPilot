"use client";

import { useStore } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { withFieldGroup } from "@/components/form/app-form";
import { fieldIds } from "@/components/form/field-ids";
import { RequiredWord } from "@/components/composites/required-mark";
import { useFieldValidity } from "@/components/form/form-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVocabulary } from "@/i18n/vocabulary";

import { AttachmentsField, type UploadedAttachment } from "./admin-use-case-attachments";
import {
  necessities,
  timelineCodes,
  timelinePresets,
  useCaseIndustries,
  useCaseTechnologies,
} from "./admin-use-case-codes";
import { currencies } from "./use-case-budget";
import { blankDraft, timelineOf, type Step } from "./use-case-draft";

/** The most any text of the use case holds, as the backend takes it. */
const MAX_TEXT = 2000;

type UseCaseStepFieldsProps = {
  /** One of the four steps that hold fields; the review step reads them all instead. */
  step: Exclude<Step, "review">;
  /** Shows the fields as they are without letting anyone change them, for the people who only review. */
  readOnly?: boolean;
  /** Where a file the use case names is read, `<path>/<file id>`; none until it is saved. */
  attachmentsPath?: string;
};

/**
 * The fields of one step of a use case, as the members write them and as GenAI Fund reads them: the same
 * fields in both places, with nothing to type into when read only. They are bound to the part of the
 * form that holds the use case: `<UseCaseStepFields form={form} fields="content" step={step} />`.
 */
const UseCaseStepFields = withFieldGroup({
  defaultValues: blankDraft,
  props: { step: "challenge" } as UseCaseStepFieldsProps,
  render: function UseCaseStepFieldsRender({ group, step, readOnly = false, attachmentsPath }) {
    const t = useTranslations("Organization.useCases.wizard");
    const industryName = useVocabulary("industry");
    const currency = useStore(group.store, (state) => state.values.currency);
    const toBeDetermined = useStore(group.store, (state) => state.values.budgetToBeDetermined);
    const maxWeeks = useStore(group.store, (state) => state.values.timelineMaxWeeks);
    const closesIds = fieldIds({ form: group.form, name: group.getFormFieldName("closesDay") });

    if (step === "challenge") {
      return (
        <FieldGroup>
          <group.AppField name="title">
            {(field) => (
              <field.TextField
                label={t("title")}
                description={t("titleHint")}
                maxLength={200}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="problemStatement">
            {(field) => (
              <field.TextareaField
                label={t("problemStatement")}
                description={t("problemStatementHint")}
                rows={4}
                maxLength={MAX_TEXT}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="industry">
            {(field) => (
              <field.SelectField
                label={t("industry")}
                placeholder={t("choose")}
                options={useCaseIndustries.map((value) => ({ value, label: industryName(value) }))}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="technologies">
            {() => <TechnologiesField readOnly={readOnly} />}
          </group.AppField>
        </FieldGroup>
      );
    }

    if (step === "outcomes") {
      return (
        <FieldGroup>
          <group.AppField name="expectedOutcomes">
            {(field) => (
              <field.TextareaField
                label={t("expectedOutcomes")}
                description={t("expectedOutcomesHint")}
                rows={4}
                maxLength={MAX_TEXT}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="currentProcess">
            {(field) => (
              <field.TextareaField
                label={t("currentProcess")}
                rows={4}
                maxLength={MAX_TEXT}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="currentSolutions">
            {(field) => (
              <field.TextareaField
                label={t("currentSolutions")}
                // One of the two the form names as not required.
                required={false}
                description={t("currentSolutionsHint")}
                rows={4}
                maxLength={MAX_TEXT}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="targetUsers">
            {(field) => (
              <field.TextareaField
                label={t("targetUsers")}
                rows={4}
                maxLength={MAX_TEXT}
                disabled={readOnly}
              />
            )}
          </group.AppField>
        </FieldGroup>
      );
    }

    if (step === "requirements") {
      return (
        <FieldGroup>
          <group.Field name="requirements" mode="array">
            {(rows) => (
              <div className="flex flex-col gap-4">
                {rows.state.value.map((_, index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-3">
                      <group.AppField name={`requirements[${index}].statement`}>
                        {(field) => (
                          <field.TextField
                            label={t("requirement", { number: index + 1 })}
                            // One requirement is asked for, and its error stands on the first row.
                            required={index === 0}
                            maxLength={300}
                            disabled={readOnly}
                          />
                        )}
                      </group.AppField>
                    </div>
                    <group.AppField name={`requirements[${index}].necessity`}>
                      {(field) => (
                        <field.SelectField
                          label={t("necessity.label")}
                          placeholder={t("choose")}
                          options={necessities.map((value) => ({
                            value,
                            label: t(`necessity.${value}`),
                          }))}
                          disabled={readOnly}
                        />
                      )}
                    </group.AppField>
                  </div>
                ))}
                {!readOnly && (
                  <TextButton
                    // 24px tall, the least a target may be when another stands right beside it.
                    className="min-h-6 self-start"
                    onClick={() => rows.pushValue({ statement: "", necessity: "required" })}
                  >
                    <PlusIcon aria-hidden="true" />
                    {t("addRequirement")}
                  </TextButton>
                )}
              </div>
            )}
          </group.Field>
          <group.AppField name="dataReadiness">
            {(field) => (
              <field.TextareaField
                label={t("dataReadiness")}
                description={t("dataReadinessHint")}
                rows={4}
                maxLength={MAX_TEXT}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="integrationRequirements">
            {(field) => (
              <field.TextareaField
                label={t("integrationRequirements")}
                description={t("integrationRequirementsHint")}
                rows={4}
                maxLength={MAX_TEXT}
                disabled={readOnly}
              />
            )}
          </group.AppField>
          <group.AppField name="attachments">
            {() => <UseCaseAttachments readOnly={readOnly} filesPath={attachmentsPath} />}
          </group.AppField>
        </FieldGroup>
      );
    }

    return (
      <FieldGroup>
        <group.AppField name="currency">
          {(field) => (
            <field.SelectField
              label={t("currency")}
              placeholder={t("choose")}
              options={currencies.map((value) => ({ value, label: t(`currencies.${value}`) }))}
              disabled={readOnly}
            />
          )}
        </group.AppField>
        <div className="grid gap-4 sm:grid-cols-2">
          <group.AppField name="budgetMin">
            {(field) => (
              <field.TextField
                label={t("budgetMin", { currency })}
                inputMode="numeric"
                maxLength={13}
                disabled={readOnly || toBeDetermined}
              />
            )}
          </group.AppField>
          <group.AppField name="budgetMax">
            {(field) => (
              <field.TextField
                label={t("budgetMax", { currency })}
                inputMode="numeric"
                maxLength={13}
                disabled={readOnly || toBeDetermined}
              />
            )}
          </group.AppField>
        </div>
        <group.AppField name="budgetToBeDetermined">
          {(field) => <field.CheckboxField label={t("budgetToBeDetermined")} disabled={readOnly} />}
        </group.AppField>
        <group.AppField name="budgetMembersOnly">
          {(field) => <field.CheckboxField label={t("budgetMembersOnly")} disabled={readOnly} />}
        </group.AppField>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* The two numbers of weeks are one choice; the field of the first carries what is wrong with it. */}
          <group.AppField name="timelineMinWeeks">
            {() => (
              <TimelineField
                maxWeeks={maxWeeks}
                onMaxWeeks={(weeks) => group.setFieldValue("timelineMaxWeeks", weeks)}
                readOnly={readOnly}
              />
            )}
          </group.AppField>
          <Field>
            <FieldLabel htmlFor={closesIds.control}>{t("closes")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <group.AppField name="closesDay">
                {() => <ClosesInput type="date" describedBy={closesIds.hint} readOnly={readOnly} />}
              </group.AppField>
              <group.AppField name="closesTime">
                {() => (
                  <ClosesInput
                    type="time"
                    label={t("closesTime")}
                    describedBy={closesIds.hint}
                    readOnly={readOnly}
                  />
                )}
              </group.AppField>
            </div>
            <FieldDescription id={closesIds.hint}>{t("closesHint")}</FieldDescription>
          </Field>
        </div>
        <group.AppField name="hideOrganizationName">
          {(field) => <field.CheckboxField label={t("hideOrganizationName")} disabled={readOnly} />}
        </group.AppField>
      </FieldGroup>
    );
  },
});

/** The id of a field's error when it has words to point at. */
function errorIdOf(id: string, invalid: boolean, errors: ({ message: string } | undefined)[]) {
  return invalid && errors.some((error) => error?.message) ? id : undefined;
}

/** The kinds of AI the use case needs, each a box to tick. */
function TechnologiesField({ readOnly }: { readOnly: boolean }) {
  const t = useTranslations("Organization.useCases.wizard");
  const technologyName = useVocabulary("technology");
  const { field, invalid, errors, ids, required } = useFieldValidity<string[]>();
  const errorId = errorIdOf(ids.error, invalid, errors);
  const labelId = `${ids.control}-label`;

  return (
    <Field data-invalid={invalid || undefined} aria-labelledby={labelId}>
      <FieldLabel id={labelId}>
        {t("technologies")}
        {required && <RequiredWord />}
      </FieldLabel>
      <div className="grid gap-x-6 gap-y-3 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5">
        {useCaseTechnologies.map((value) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              disabled={readOnly}
              checked={field.state.value.includes(value)}
              aria-invalid={invalid || undefined}
              aria-describedby={errorId}
              onCheckedChange={(checked) =>
                field.handleChange(
                  checked === true
                    ? [...field.state.value, value]
                    : field.state.value.filter((chosen) => chosen !== value),
                )
              }
            />
            {technologyName(value)}
          </label>
        ))}
      </div>
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

/** The files that explain the use case, held by the form. */
function UseCaseAttachments({ readOnly, filesPath }: { readOnly: boolean; filesPath?: string }) {
  const { field, invalid, errors, ids } = useFieldValidity<UploadedAttachment[]>();
  return (
    <AttachmentsField
      id={ids.control}
      readOnly={readOnly}
      filesPath={filesPath}
      value={field.state.value}
      onChange={field.handleChange}
      errors={invalid ? errors.filter((error) => error !== undefined) : undefined}
    />
  );
}

type TimelineFieldProps = {
  /** The most weeks, which the field of the fewest weeks is chosen with. */
  maxWeeks: number | null;
  onMaxWeeks: (weeks: number) => void;
  readOnly: boolean;
};

/** The preferred timeline: one of the presets, kept as the weeks it stands for. */
function TimelineField({ maxWeeks, onMaxWeeks, readOnly }: TimelineFieldProps) {
  const t = useTranslations("Organization.useCases.wizard");
  const { field, invalid, errors, ids, required } = useFieldValidity<number | null>();
  const errorId = errorIdOf(ids.error, invalid, errors);
  const options = timelineCodes.map((value) => ({ value, label: t(`timeline.${value}`) }));
  const chosen = timelineOf({ timelineMinWeeks: field.state.value, timelineMaxWeeks: maxWeeks });

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={ids.control}>{t("timeline.label")}</FieldLabel>
      <Select
        items={options}
        value={chosen || null}
        disabled={readOnly}
        onValueChange={(code) => {
          const weeks = timelinePresets[code as keyof typeof timelinePresets];
          onMaxWeeks(weeks.max);
          field.handleChange(weeks.min);
        }}
      >
        <SelectTrigger
          id={ids.control}
          aria-invalid={invalid || undefined}
          aria-required={required}
          aria-describedby={errorId}
          className="w-full"
        >
          <SelectValue placeholder={t("choose")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

type ClosesInputProps = {
  type: "date" | "time";
  /** Names the input that the label of the pair does not point at. */
  label?: string;
  /** The hint the two inputs share. */
  describedBy: string;
  readOnly: boolean;
};

/** The day or the time proposals close, one of the two inputs under one label. */
function ClosesInput({ type, label, describedBy, readOnly }: ClosesInputProps) {
  const { field, invalid, errors, ids, required } = useFieldValidity<string>();
  const errorId = errorIdOf(ids.error, invalid, errors);

  return (
    <div className="flex flex-col gap-1">
      <Input
        id={ids.control}
        name={field.name}
        type={type}
        disabled={readOnly}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-required={required}
        aria-describedby={errorId ? `${describedBy} ${errorId}` : describedBy}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {invalid && <FieldError id={errorId} errors={errors} />}
    </div>
  );
}

export { UseCaseStepFields };
