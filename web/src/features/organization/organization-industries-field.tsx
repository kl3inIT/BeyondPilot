"use client";

import { useTranslations } from "next-intl";

import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { RequiredMark } from "@/components/composites/required-mark";
import { useFieldValidity } from "@/components/form/form-context";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { useVocabulary } from "@/i18n/vocabulary";

import { industries } from "./organization-codes";
import { MAX_INDUSTRIES } from "./organization-format";

/**
 * The industries of the profile, found by typing: the form's field, with how many are chosen under
 * it. Only a company has to name one, so the star follows the type and the others read Optional.
 */
function OrganizationIndustriesField({ required }: { required: boolean }) {
  const t = useTranslations("Organization.form");
  const marks = useTranslations("Form");
  const industryName = useVocabulary("industry");
  const { field, invalid, errors, ids } = useFieldValidity<string[]>();
  const { control: controlId, hint: hintId, error: errorId } = ids;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={controlId}>
        {t("industries")}
        {required ? (
          <RequiredMark />
        ) : (
          <span className="font-normal text-muted-foreground">{marks("optional")}</span>
        )}
      </FieldLabel>
      <ChoiceCombobox
        id={controlId}
        aria-required={required || undefined}
        label={t("industries")}
        placeholder={t("industriesPlaceholder")}
        emptyLabel={t("industriesEmpty")}
        removeLabel={(industry) => t("industriesRemove", { industry })}
        aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
        aria-invalid={invalid || undefined}
        options={industries.map((value) => ({ value, label: industryName(value) }))}
        value={field.state.value}
        onValueChange={field.handleChange}
        max={MAX_INDUSTRIES}
      />
      <FieldDescription id={hintId}>
        {t("industriesHint", { count: MAX_INDUSTRIES, chosen: field.state.value.length })}
      </FieldDescription>
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

export { OrganizationIndustriesField };
