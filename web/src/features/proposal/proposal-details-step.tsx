"use client";

import { useTranslations } from "next-intl";

import { withFieldGroup } from "@/components/form/app-form";
import { useFieldValidity } from "@/components/form/form-context";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { countryCodes, useCountryName } from "@/i18n/vocabulary";

import type { Details } from "./proposal-draft";
import { phoneSchema } from "./proposal-schemas";

type ProposalDetailsStepProps = {
  /** The address of the account, which is not changed here. */
  email: string;
};

/** The submitting identity: the account's name, address, country and number, the fields the brief asks for. */
const ProposalDetailsStep = withFieldGroup({
  defaultValues: { name: "", country: "", phone: "" } as Details,
  props: { email: "" } as ProposalDetailsStepProps,
  render: function ProposalDetailsStepRender({ group, email }) {
    const t = useTranslations("UseCaseProposal.wizard.details");

    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <group.AppField name="name">
          {(field) => <field.TextField label={t("name")} autoComplete="name" maxLength={120} />}
        </group.AppField>
        <Field>
          <FieldLabel htmlFor="proposal-email">{t("email")}</FieldLabel>
          <Input id="proposal-email" value={email} readOnly disabled />
        </Field>
        <group.AppField name="country">{() => <CountryField />}</group.AppField>
        {/* A number that cannot be one is said while it is typed, before the step is left. */}
        <group.AppField
          name="phone"
          validators={{ onChange: phoneSchema(() => t("phoneInvalid")) }}
        >
          {(field) => (
            <field.TextField
              label={t("phone")}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              placeholder="+84 912 345 678"
            />
          )}
        </group.AppField>
      </div>
    );
  },
});

/** The country, in the browser's own list so a phone shows its picker. */
function CountryField() {
  const t = useTranslations("UseCaseProposal.wizard.details");
  const countryName = useCountryName();
  const { field, invalid, errors } = useFieldValidity<string>();
  const errorId = `${field.name}-error`;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={field.name}>{t("country")}</FieldLabel>
      <NativeSelect
        id={field.name}
        name={field.name}
        className="w-full"
        autoComplete="country"
        value={field.state.value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      >
        <NativeSelectOption value="">{t("countryPlaceholder")}</NativeSelectOption>
        {countryCodes.map((code) => (
          <NativeSelectOption key={code} value={code}>
            {countryName(code)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {invalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  );
}

export { ProposalDetailsStep };
