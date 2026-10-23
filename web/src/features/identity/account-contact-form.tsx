"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { useAppForm } from "@/components/form/app-form";
import { Field, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName } from "@/i18n/vocabulary";
import { updateMyContact, type Me } from "@/lib/api/generated";

import { contactBodyOf, contactSchema, contactValuesOf, MAX_NAME } from "./identity-schemas";

/**
 * What a person is called, where they are and the number to reach them on, kept on the account. The
 * name is theirs to change; the address they sign in with is not, so it is read here, not typed.
 * The country and the number may stay empty; an application asks for them when it needs them and
 * starts from what is kept here.
 */
function AccountContactForm({ account }: { account: Me }) {
  const t = useTranslations("Account");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: contactValuesOf(account),
    // The number is checked as it is typed, so a letter is refused where it is written.
    validators: { onChange: contactSchema(t) },
    onSubmit: async ({ value }) => {
      try {
        await updateMyContact({ body: contactBodyOf(value) });
        notify.success("Account.saved");
        // The header reads the account again, so it shows the new name.
        router.refresh();
      } catch (error) {
        notify.failure(error, { otherwise: "Account.failed" });
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
      aria-labelledby="contact-details"
      className="flex flex-col gap-5 rounded-2xl border bg-card p-5 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="contact-details" className="text-base font-medium">
          {t("contact.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("contact.lead")}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={t("name")}
              requiredMark
              autoComplete="name"
              maxLength={MAX_NAME}
            />
          )}
        </form.AppField>
        <Field>
          <FieldTitle>{t("email")}</FieldTitle>
          <p className="text-sm break-all">{account.email}</p>
          <FieldDescription>{t("emailHint")}</FieldDescription>
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
