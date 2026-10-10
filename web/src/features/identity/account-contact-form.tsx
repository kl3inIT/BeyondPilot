"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
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
  const [country, setCountry] = useState(account.country ?? "");
  const [phone, setPhone] = useState(account.phone ?? "");
  const [pending, setPending] = useState(false);
  const badPhone = !PHONE.test(phone.trim());

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (badPhone) {
      return;
    }
    setPending(true);
    try {
      await updateMyContact({ body: { country: country || null, phone: phone.trim() || null } });
      notify.success("Account.saved");
      router.refresh();
    } catch {
      notify.error("Account.failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5 rounded-2xl border bg-card p-5 md:p-6">
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
        <Field>
          <FieldLabel htmlFor="account-country">{t("country")}</FieldLabel>
          <NativeSelect
            id="account-country"
            className="w-full"
            autoComplete="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            <NativeSelectOption value="">{t("countryPlaceholder")}</NativeSelectOption>
            {countryCodes.map((code) => (
              <NativeSelectOption key={code} value={code}>
                {countryName(code)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={badPhone || undefined}>
          <FieldLabel htmlFor="account-phone">{t("phone")}</FieldLabel>
          <Input
            id="account-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={badPhone || undefined}
            aria-describedby="account-phone-hint"
          />
          <FieldDescription id="account-phone-hint">{t("phoneHint")}</FieldDescription>
          {badPhone && <FieldError>{t("phoneInvalid")}</FieldError>}
        </Field>
      </div>
      <div>
        <Button type="submit" pending={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

export { AccountContactForm };
