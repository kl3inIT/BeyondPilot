"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { useAppForm } from "@/components/form/app-form";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName } from "@/i18n/vocabulary";
import { updateMyContact, type Me } from "@/lib/api/generated";

/** A number as the backend takes it: digits with spaces, brackets, dots or dashes, and a leading plus. */
const PHONE = /^\+?[0-9 ().-]*$/;

/**
 * Where a person is and the number to reach them on, kept on the account. Both may stay empty; an
 * application asks for them when it needs them and starts from what is kept here.
 */
function AccountContactForm({ account }: { account: Me }) {
  const t = useTranslations("Account");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: { country: account.country ?? "", phone: account.phone ?? "" },
    // The number is checked as it is typed, so a letter is refused where it is written.
    validators: {
      onChange: z.object({
        country: z.string(),
        phone: z.string().trim().regex(PHONE, t("phoneInvalid")),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await updateMyContact({
          body: { country: value.country || null, phone: value.phone.trim() || null },
        });
        notify.success("Account.saved");
        router.refresh();
      } catch {
        notify.error("Account.failed");
      }
    },
  });

  return (
    <form
      id={form.formId}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-5 rounded-2xl border bg-card p-5 md:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="account-name">{t("name")}</FieldLabel>
          <Input id="account-name" value={account.displayName ?? ""} readOnly disabled />
        </Field>
        <Field>
          <FieldLabel htmlFor="account-email">{t("email")}</FieldLabel>
          <Input
            id="account-email"
            value={account.email}
            readOnly
            disabled
            aria-describedby="account-email-hint"
          />
          <FieldDescription id="account-email-hint">{t("emailHint")}</FieldDescription>
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="country">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="account-country">{t("country")}</FieldLabel>
              <NativeSelect
                id="account-country"
                className="w-full"
                autoComplete="country"
                value={field.state.value}
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
            </Field>
          )}
        </form.Field>
        <form.AppField name="phone">
          {(field) => (
            <field.TextField
              label={t("phone")}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              description={t("phoneHint")}
            />
          )}
        </form.AppField>
      </div>
      <div>
        <form.AppForm>
          <form.SubmitButton>{t("save")}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}

export { AccountContactForm };
