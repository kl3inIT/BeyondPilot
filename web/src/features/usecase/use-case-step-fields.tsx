"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useVocabulary } from "@/i18n/vocabulary";

import { AttachmentsField } from "./admin-use-case-attachments";
import {
  necessities,
  timelineCodes,
  timelinePresets,
  useCaseIndustries,
  useCaseTechnologies,
} from "./admin-use-case-codes";
import { currencies, type BudgetCurrency } from "./use-case-budget";
import { timelineOf, type DraftValues, type Step } from "./use-case-draft";
import { Choice, ReadOnlyProvider, TextArea, TextInput, Tick } from "./wizard-fields";

/** The most any text of the use case holds, as the backend takes it. */
const MAX_TEXT = 2000;

type UseCaseStepFieldsProps = {
  /** One of the four steps that hold fields; the review step reads them all instead. */
  step: Exclude<Step, "review">;
  values: DraftValues;
  onChange: (patch: Partial<DraftValues>) => void;
  /** Shows the fields as they are without letting anyone change them, for the people who only review. */
  readOnly?: boolean;
};

/**
 * The fields of one step of a use case, as the members write them and as GenAI Fund reads them: the same
 * fields in both places, with nothing to type into when read only.
 */
function UseCaseStepFields({ step, values, onChange, readOnly = false }: UseCaseStepFieldsProps) {
  const t = useTranslations("Organization.useCases.wizard");
  const industryName = useVocabulary("industry");
  const technologyName = useVocabulary("technology");
  const timeline = timelineOf(values);

  return (
    <ReadOnlyProvider readOnly={readOnly}>
      {step === "challenge" && (
        <FieldGroup>
          <TextInput
            label={t("title")}
            hint={t("titleHint")}
            maxLength={200}
            value={values.title}
            onValueChange={(title) => onChange({ title })}
          />
          <TextArea
            label={t("problemStatement")}
            hint={t("problemStatementHint")}
            maxLength={MAX_TEXT}
            value={values.problemStatement}
            onValueChange={(problemStatement) => onChange({ problemStatement })}
          />
          <Choice
            label={t("industry")}
            placeholder={t("choose")}
            options={useCaseIndustries.map((value) => ({ value, label: industryName(value) }))}
            value={values.industry}
            onValueChange={(industry) => onChange({ industry })}
          />
          <Field>
            <FieldLabel>{t("technologies")}</FieldLabel>
            <div className="grid gap-x-6 gap-y-3 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5">
              {useCaseTechnologies.map((value) => (
                <label key={value} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    disabled={readOnly}
                    checked={values.technologies.includes(value)}
                    onCheckedChange={(checked) =>
                      onChange({
                        technologies:
                          checked === true
                            ? [...values.technologies, value]
                            : values.technologies.filter((chosen) => chosen !== value),
                      })
                    }
                  />
                  {technologyName(value)}
                </label>
              ))}
            </div>
          </Field>
        </FieldGroup>
      )}

      {step === "outcomes" && (
        <FieldGroup>
          <TextArea
            label={t("expectedOutcomes")}
            hint={t("expectedOutcomesHint")}
            maxLength={MAX_TEXT}
            value={values.expectedOutcomes}
            onValueChange={(expectedOutcomes) => onChange({ expectedOutcomes })}
          />
          <TextArea
            label={t("currentProcess")}
            hint={t("currentProcessHint")}
            maxLength={MAX_TEXT}
            value={values.currentProcess}
            onValueChange={(currentProcess) => onChange({ currentProcess })}
          />
          <TextArea
            label={t("currentSolutions")}
            hint={t("currentSolutionsHint")}
            maxLength={MAX_TEXT}
            value={values.currentSolutions}
            onValueChange={(currentSolutions) => onChange({ currentSolutions })}
          />
          <TextArea
            label={t("targetUsers")}
            hint={t("targetUsersHint")}
            maxLength={MAX_TEXT}
            value={values.targetUsers}
            onValueChange={(targetUsers) => onChange({ targetUsers })}
          />
        </FieldGroup>
      )}

      {step === "requirements" && (
        <FieldGroup>
          <div className="flex flex-col gap-4">
            {values.requirements.map((requirement, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-3">
                  <TextInput
                    label={t("requirement", { number: index + 1 })}
                    maxLength={300}
                    value={requirement.statement}
                    onValueChange={(statement) =>
                      onChange({
                        requirements: values.requirements.map((row, at) =>
                          at === index ? { ...row, statement } : row,
                        ),
                      })
                    }
                  />
                </div>
                <Choice
                  label={t("necessity.label")}
                  placeholder={t("choose")}
                  options={necessities.map((value) => ({
                    value,
                    label: t(`necessity.${value}`),
                  }))}
                  value={requirement.necessity}
                  onValueChange={(necessity) =>
                    onChange({
                      requirements: values.requirements.map((row, at) =>
                        at === index
                          ? {
                              ...row,
                              necessity: necessity === "optional" ? "optional" : "required",
                            }
                          : row,
                      ),
                    })
                  }
                />
              </div>
            ))}
            {!readOnly && (
              <TextButton
                className="self-start"
                onClick={() =>
                  onChange({
                    requirements: [
                      ...values.requirements,
                      { statement: "", necessity: "required" },
                    ],
                  })
                }
              >
                <PlusIcon aria-hidden="true" />
                {t("addRequirement")}
              </TextButton>
            )}
          </div>
          <TextArea
            label={t("dataReadiness")}
            hint={t("dataReadinessHint")}
            maxLength={MAX_TEXT}
            value={values.dataReadiness}
            onValueChange={(dataReadiness) => onChange({ dataReadiness })}
          />
          <TextArea
            label={t("integrationRequirements")}
            hint={t("integrationRequirementsHint")}
            maxLength={MAX_TEXT}
            value={values.integrationRequirements}
            onValueChange={(integrationRequirements) => onChange({ integrationRequirements })}
          />
          <AttachmentsField
            id="attachments"
            readOnly={readOnly}
            value={values.attachments}
            onChange={(attachments) => onChange({ attachments })}
          />
        </FieldGroup>
      )}

      {step === "budget" && (
        <FieldGroup>
          <Choice
            label={t("currency")}
            placeholder={t("choose")}
            options={currencies.map((value) => ({ value, label: t(`currencies.${value}`) }))}
            value={values.currency}
            onValueChange={(currency) => onChange({ currency: currency as BudgetCurrency })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t("budgetMin", { currency: values.currency })}
              inputMode="numeric"
              maxLength={13}
              disabled={values.budgetToBeDetermined}
              value={values.budgetMin}
              onValueChange={(budgetMin) => onChange({ budgetMin })}
            />
            <TextInput
              label={t("budgetMax", { currency: values.currency })}
              inputMode="numeric"
              maxLength={13}
              disabled={values.budgetToBeDetermined}
              value={values.budgetMax}
              onValueChange={(budgetMax) => onChange({ budgetMax })}
            />
          </div>
          <Tick
            label={t("budgetToBeDetermined")}
            checked={values.budgetToBeDetermined}
            onCheckedChange={(budgetToBeDetermined) => onChange({ budgetToBeDetermined })}
          />
          <Tick
            label={t("budgetMembersOnly")}
            checked={values.budgetMembersOnly}
            onCheckedChange={(budgetMembersOnly) => onChange({ budgetMembersOnly })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Choice
              label={t("timeline.label")}
              placeholder={t("choose")}
              options={timelineCodes.map((value) => ({ value, label: t(`timeline.${value}`) }))}
              value={timeline}
              onValueChange={(code) => {
                const weeks = timelinePresets[code as keyof typeof timelinePresets];
                onChange({ timelineMinWeeks: weeks.min, timelineMaxWeeks: weeks.max });
              }}
            />
            <Field>
              <FieldLabel htmlFor="closesDay">{t("closes")}</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="closesDay"
                  type="date"
                  disabled={readOnly}
                  value={values.closesDay}
                  onChange={(event) => onChange({ closesDay: event.target.value })}
                />
                <Input
                  type="time"
                  disabled={readOnly}
                  aria-label={t("closesTime")}
                  value={values.closesTime}
                  onChange={(event) => onChange({ closesTime: event.target.value })}
                />
              </div>
              <FieldDescription>{t("closesHint")}</FieldDescription>
            </Field>
          </div>
          <Tick
            label={t("hideOrganizationName")}
            checked={values.hideOrganizationName}
            onCheckedChange={(hideOrganizationName) => onChange({ hideOrganizationName })}
          />
        </FieldGroup>
      )}
    </ReadOnlyProvider>
  );
}

export { UseCaseStepFields };
