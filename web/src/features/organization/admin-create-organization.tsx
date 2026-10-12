"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { PlusIcon, BuildingIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { focusFirstInvalidSoon } from "@/components/form/focus-first-invalid";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { createAdminOrganization, type AdminCreateOrganization } from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";

import { industries, organizationTypes, teamSizes } from "./organization-codes";
import { organizationError } from "./organization-errors";
import { MAX_DESCRIPTION, MAX_INDUSTRIES, yearOf } from "./organization-format";
import { OrganizationLogoUpload } from "./organization-logo-upload";
import { useVerifiedDomain } from "./verified-domain";

const blank = {
  name: "",
  type: "",
  website: "",
  ownerEmail: "",
  country: "",
  teamSize: "",
  foundedYear: "",
  description: "",
  logoFileId: "",
  industries: [] as string[],
};

/**
 * Creates an organization on behalf of its people, already approved: GenAI Fund lists a company
 * before anyone from it signs in. Only the name and the type are needed; whatever else the operator
 * knows is filled in now, and the rest is left to the owner. With an owner's address, that person is
 * invited to own it; without one, the first person on its email domain owns it, or someone claims it.
 */
function AdminCreateOrganization() {
  const t = useTranslations("Admin.organizations.create");
  const f = useTranslations("Organization.form");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The domain keeps its own state: the same field stands in the decision dialogs, outside a form.
  const domain = useVerifiedDomain(null);

  /** What a field the backend rejected says; one without words here is only marked. */
  const rejections: Partial<Record<keyof typeof blank, string>> = {
    name: t("nameRequired"),
    type: t("typeRequired"),
    website: t("websiteInvalid"),
    ownerEmail: t("ownerEmailInvalid"),
    foundedYear: f("foundedYearInvalid"),
  };

  const form = useAppForm({
    defaultValues: blank,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        name: z.string().refine((text) => text.trim() !== "", t("nameRequired")),
        type: z.string().min(1, t("typeRequired")),
        website: z
          .string()
          .refine(
            (text) => !text.trim() || /^https?:\/\/\S+$/.test(text.trim()),
            t("websiteInvalid"),
          ),
        ownerEmail: z
          .string()
          .refine(
            (text) => !text.trim() || z.email().safeParse(text.trim()).success,
            t("ownerEmailInvalid"),
          ),
        country: z.string(),
        teamSize: z.string(),
        foundedYear: z
          .string()
          .refine((text) => !text.trim() || yearOf(text) !== null, f("foundedYearInvalid")),
        description: z.string(),
        logoFileId: z.string(),
        industries: z.array(z.string()),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      const emailDomain = domain.read();
      if (emailDomain === undefined) {
        focusFirstInvalidSoon(() => document.getElementById(formApi.formId));
        return;
      }
      try {
        await createAdminOrganization({
          body: {
            name: value.name.trim(),
            type: value.type as AdminCreateOrganization["type"],
            website: value.website.trim() || null,
            country: value.country || null,
            teamSize: (value.teamSize || null) as AdminCreateOrganization["teamSize"],
            industries: value.industries.length > 0 ? value.industries : null,
            description: value.description.trim() || null,
            foundedYear: value.foundedYear.trim() ? yearOf(value.foundedYear) : null,
            logoFileId: value.logoFileId || null,
            emailDomain,
            ownerEmail: value.ownerEmail.trim() || null,
          },
        });
        notify.success("Organization.done.adminCreated", { name: value.name.trim() });
        setOpen(false);
        formApi.reset();
        domain.change("");
        router.refresh();
      } catch (error) {
        const rejected = [...rejectedFields(error)].filter((field) => field in blank);
        setServerErrors(formApi, {
          fields: Object.fromEntries(
            rejected.map((field) => [
              field,
              { message: rejections[field as keyof typeof blank] ?? "" },
            ]),
          ),
        });
        if (!domain.refused(error)) {
          notify.error(organizationError(error));
        }
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="max-h-dvh overflow-y-auto sm:max-w-3xl">
          <form
            id={form.formId}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              // The domain is checked with the other fields, so every problem shows at once.
              domain.read();
              void form.handleSubmit();
            }}
          >
            <DecisionDialogHeader tone="info" icon={BuildingIcon} title={t("title")} />
            <FieldGroup>
              <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
                <form.AppField name="name">
                  {(field) => <field.TextField label={t("name")} requiredMark maxLength={120} />}
                </form.AppField>
                <form.AppField name="type">
                  {(field) => (
                    <field.SelectField
                      label={t("type")}
                      requiredMark
                      placeholder={t("typePlaceholder")}
                      options={organizationTypes.map((value) => ({
                        value,
                        label: typeName(value),
                      }))}
                    />
                  )}
                </form.AppField>
                <form.AppField name="website">
                  {(field) => (
                    <field.TextField
                      label={t("website")}
                      type="url"
                      inputMode="url"
                      maxLength={300}
                      description={t("websiteHint")}
                    />
                  )}
                </form.AppField>
                <form.AppField name="ownerEmail">
                  {(field) => (
                    <field.TextField
                      label={t("ownerEmail")}
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={254}
                    />
                  )}
                </form.AppField>
                <Field data-invalid={domain.problem !== null || undefined}>
                  <FieldLabel htmlFor="admin-organization-domain">{t("emailDomain")}</FieldLabel>
                  <Input
                    id="admin-organization-domain"
                    inputMode="url"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={253}
                    value={domain.text}
                    aria-invalid={domain.problem !== null || undefined}
                    aria-describedby={
                      domain.problem
                        ? "admin-organization-domain-hint admin-organization-domain-error"
                        : "admin-organization-domain-hint"
                    }
                    onChange={(event) => domain.change(event.target.value)}
                  />
                  <FieldDescription id="admin-organization-domain-hint">
                    {t("emailDomainHint")}
                  </FieldDescription>
                  {domain.problem && (
                    <FieldError id="admin-organization-domain-error">
                      {f(`domain.${domain.problem}`)}
                    </FieldError>
                  )}
                </Field>
                <form.AppField name="country">
                  {(field) => (
                    <field.SelectField
                      label={f("country")}
                      placeholder={f("countryPlaceholder")}
                      options={countryCodes.map((value) => ({ value, label: countryName(value) }))}
                    />
                  )}
                </form.AppField>
                <form.AppField name="teamSize">
                  {(field) => (
                    <field.SelectField
                      label={f("teamSize")}
                      placeholder={f("teamSizePlaceholder")}
                      options={teamSizes.map((value) => ({ value, label: sizeName(value) }))}
                    />
                  )}
                </form.AppField>
                <form.AppField name="foundedYear">
                  {(field) => (
                    <field.TextField label={f("foundedYear")} inputMode="numeric" maxLength={4} />
                  )}
                </form.AppField>
              </div>
              <form.Field name="industries">
                {(field) => {
                  const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor="admin-organization-industries">
                        {f("industries")}
                      </FieldLabel>
                      <ChoiceCombobox
                        id="admin-organization-industries"
                        label={f("industries")}
                        placeholder={f("industriesPlaceholder")}
                        emptyLabel={f("industriesEmpty")}
                        removeLabel={(industry) => f("industriesRemove", { industry })}
                        aria-invalid={invalid || undefined}
                        options={industries.map((value) => ({
                          value,
                          label: industryName(value),
                        }))}
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        max={MAX_INDUSTRIES}
                      />
                    </Field>
                  );
                }}
              </form.Field>
              <div className="flex flex-col gap-6 sm:flex-row sm:gap-3">
                <div className="sm:flex-1">
                  <form.AppField name="description">
                    {(field) => (
                      <field.TextareaField
                        label={f("description")}
                        rows={3}
                        maxLength={MAX_DESCRIPTION}
                      />
                    )}
                  </form.AppField>
                </div>
                <form.Field name="logoFileId">
                  {(field) => (
                    <Field className="sm:w-auto">
                      <FieldLabel htmlFor="organization-logo">{f("logo.label")}</FieldLabel>
                      <OrganizationLogoUpload
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>
            </FieldGroup>
            <DialogFooter variant="plain">
              <Button
                size="lg"
                prominence="secondary"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button size="lg" type="submit" pending={pending}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AdminCreateOrganization };
