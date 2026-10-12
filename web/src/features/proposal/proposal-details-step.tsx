"use client";

import { useTranslations } from "next-intl";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { countryCodes, useCountryName } from "@/i18n/vocabulary";

import { phoneValid, type Details } from "./proposal-draft";

type ProposalDetailsStepProps = {
  details: Details;
  onDetails: (details: Details) => void;
  /** The address of the account, which is not changed here. */
  email: string;
  /** A name the account already has is kept, so it is only read. */
  nameLocked: boolean;
  /** Whether the missing parts are pointed out. */
  checked: boolean;
};

/** The submitting identity: the account's name, address, country and number, the fields the brief asks for. */
function ProposalDetailsStep({
  details,
  onDetails,
  email,
  nameLocked,
  checked,
}: ProposalDetailsStepProps) {
  const t = useTranslations("UseCaseProposal.wizard.details");
  const countryName = useCountryName();
  const nameMissing = checked && details.name.trim() === "";
  const countryMissing = checked && details.country === "";
  const phoneMissing = checked && details.phone.trim() === "";
  const phoneBad = details.phone.trim() !== "" && !phoneValid(details.phone);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field data-invalid={nameMissing || undefined}>
        <FieldLabel htmlFor="proposal-name">{t("name")}</FieldLabel>
        <Input
          id="proposal-name"
          autoComplete="name"
          maxLength={120}
          value={details.name}
          readOnly={nameLocked}
          disabled={nameLocked}
          onChange={(event) => onDetails({ ...details, name: event.target.value })}
          aria-invalid={nameMissing || undefined}
        />
        {nameMissing && <FieldError>{t("required")}</FieldError>}
      </Field>
      <Field>
        <FieldLabel htmlFor="proposal-email">{t("email")}</FieldLabel>
        <Input id="proposal-email" value={email} readOnly disabled />
      </Field>
      <Field data-invalid={countryMissing || undefined}>
        <FieldLabel htmlFor="proposal-country">{t("country")}</FieldLabel>
        <NativeSelect
          id="proposal-country"
          className="w-full"
          autoComplete="country"
          value={details.country}
          onChange={(event) => onDetails({ ...details, country: event.target.value })}
          aria-invalid={countryMissing || undefined}
        >
          <NativeSelectOption value="">{t("countryPlaceholder")}</NativeSelectOption>
          {countryCodes.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {countryName(code)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {countryMissing && <FieldError>{t("required")}</FieldError>}
      </Field>
      <Field data-invalid={phoneMissing || phoneBad || undefined}>
        <FieldLabel htmlFor="proposal-phone">{t("phone")}</FieldLabel>
        <Input
          id="proposal-phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={40}
          placeholder="+84 912 345 678"
          value={details.phone}
          onChange={(event) => onDetails({ ...details, phone: event.target.value })}
          aria-invalid={phoneMissing || phoneBad || undefined}
        />
        {phoneMissing && <FieldError>{t("required")}</FieldError>}
        {phoneBad && <FieldError>{t("phoneInvalid")}</FieldError>}
      </Field>
    </div>
  );
}

export { ProposalDetailsStep };
