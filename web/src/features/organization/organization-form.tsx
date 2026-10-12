"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Building2Icon, FileTextIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/actions/button";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { RequiredMark } from "@/components/composites/required-mark";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { focusFirstInvalidSoon } from "@/components/form/focus-first-invalid";
import { useFieldValidity } from "@/components/form/form-context";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  createOrganization,
  saveAdminOrganization,
  saveMyOrganization,
  type Organization,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { siteRoutes } from "@/lib/site";

import { industries, organizationTypes, teamSizes } from "./organization-codes";
import { organizationError } from "./organization-errors";
import { MAX_DESCRIPTION, MAX_INDUSTRIES } from "./organization-format";
import { OrganizationLogoUpload } from "./organization-logo-upload";
import { OrganizationProfileSection } from "./organization-profile-section";
import {
  profileBodyOf,
  profileRefusals,
  profileSchema,
  profileValuesOf,
} from "./organization-schemas";
import { useVerifiedDomain, VerifiedDomainField } from "./verified-domain";

/**
 * The industries of the profile, found by typing: the form's field, with how many are chosen under
 * it. Only a company has to name one, so the star follows the type.
 */
function IndustriesField({ required }: { required: boolean }) {
  const t = useTranslations("Organization.form");
  const industryName = useVocabulary("industry");
  const { field, invalid, errors, ids } = useFieldValidity<string[]>();
  const { control: controlId, hint: hintId, error: errorId } = ids;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={controlId}>
        {t("industries")}
        {required && <RequiredMark />}
      </FieldLabel>
      <ChoiceCombobox
        id={controlId}
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

type OrganizationFormProps = {
  /** The organization to change; without one the form creates it. */
  organization?: Organization;
  /** Set when an operator changes the organization: the form then also holds its verified domain. */
  admin?: boolean;
  /** Leaves a saved profile unchanged and closes the form. */
  onCancel?: () => void;
};

/**
 * The profile of an organization, as its owner writes it: to create one, or to change the one they
 * own. The backend decides what is valid; a member it rejects is marked here by its name.
 */
function OrganizationForm({ organization, admin, onCancel }: OrganizationFormProps) {
  const t = useTranslations("Organization.form");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  // The domain keeps its own state: the same field stands in the decision dialogs, outside a form.
  const domain = useVerifiedDomain(organization?.emailDomain);
  // A saved profile is compared with the one the page holds, which is the old one until it is read
  // again; a new organization stays pending until its pages arrive.
  const [leaving, startLeaving] = useTransition();
  const [discarding, setDiscarding] = useState(false);

  const form = useAppForm({
    defaultValues: profileValuesOf(organization),
    validationLogic: revalidateLogic(),
    validators: { onDynamic: profileSchema(t) },
    // The domain is checked with the other fields, so every problem shows at once.
    onSubmitInvalid: () => {
      if (admin) {
        void domain.read();
      }
    },
    onSubmit: async ({ value, formApi }) => {
      const emailDomain = admin ? domain.read() : null;
      if (emailDomain === undefined) {
        focusFirstInvalidSoon(() => document.getElementById(formApi.formId));
        return;
      }
      const body = profileBodyOf(value);
      try {
        if (organization && admin) {
          await saveAdminOrganization({
            path: { id: organization.id },
            body: { profile: { ...body, version: organization.version }, emailDomain },
          });
          notify.success("Organization.done.saved");
          startLeaving(() => router.refresh());
        } else if (organization) {
          await saveMyOrganization({ body: { ...body, version: organization.version } });
          notify.success("Organization.done.saved");
          startLeaving(() => router.refresh());
        } else {
          await createOrganization({ body });
          notify.success("Organization.done.created");
          startLeaving(() =>
            router.push(getPathname({ href: siteRoutes.workspaceOrganization, locale })),
          );
        }
      } catch (error) {
        // An operator's save holds the profile under `profile`.
        const rejected = [...rejectedFields(error, admin ? "profile" : undefined)].filter(
          (field): field is keyof typeof profileRefusals => field in profileRefusals,
        );
        setServerErrors(formApi, {
          fields: Object.fromEntries(
            rejected.map((field) => [field, { message: t(profileRefusals[field]) }]),
          ),
        });
        // A domain another organization has is said at its field; anything else in a toast.
        if (!domain.refused(error)) {
          notify.error(organizationError(error));
        }
      }
    },
  });

  const type = useStore(form.store, (state) => state.values.type);
  const pending = useStore(form.store, (state) => state.isSubmitting) || leaving;
  const changed =
    useStore(form.store, (state) => !state.isDefaultValue) ||
    domain.text !== (organization?.emailDomain ?? "");
  // Only a saved profile can differ from what was saved; a new one has nothing to lose yet.
  const dirty = organization !== undefined && !pending && changed;

  // The form's title is the page's on the create page; on the profile it sits under the organization's name.
  const Title = organization ? "h2" : "h1";

  return (
    <form
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-7 rounded-3xl border bg-card p-5 md:p-10"
    >
      <div className="flex flex-col gap-2">
        <Title className="text-3xl font-semibold tracking-title">
          {t(organization ? "profileTitle" : "createTitle")}
        </Title>
        {!organization && <p className="text-muted-foreground">{t("createLead")}</p>}
      </div>

      <OrganizationProfileSection icon={Building2Icon} title={t("basics")}>
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("name")}
                requiredMark
                autoComplete="organization"
                maxLength={120}
              />
            )}
          </form.AppField>
          <form.AppField name="website">
            {(field) => (
              <field.TextField
                label={t("website")}
                requiredMark
                type="url"
                inputMode="url"
                autoComplete="url"
                maxLength={300}
                description={t(
                  type === "independent_builder" ? "websiteHint" : "websiteFormatHint",
                )}
              />
            )}
          </form.AppField>
        </div>
        {/* An operator changes the verified domain in its own section below. */}
        {organization?.emailDomain && !admin && (
          <Field>
            <FieldLabel htmlFor="organization-email-domain">{t("emailDomain")}</FieldLabel>
            <Input
              id="organization-email-domain"
              value={organization.emailDomain}
              aria-describedby="organization-email-domain-hint"
              disabled
              readOnly
            />
            <p id="organization-email-domain-hint" className="text-xs text-muted-foreground">
              {t("emailDomainHint")}
            </p>
          </Field>
        )}
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <form.AppField name="type">
            {(field) => (
              <field.SelectField
                label={t("type")}
                requiredMark
                options={organizationTypes.map((value) => ({ value, label: typeName(value) }))}
              />
            )}
          </form.AppField>
          <form.AppField name="teamSize">
            {(field) => (
              <field.SelectField
                label={t("teamSize")}
                requiredMark
                placeholder={t("teamSizePlaceholder")}
                options={teamSizes.map((value) => ({ value, label: sizeName(value) }))}
              />
            )}
          </form.AppField>
        </div>
      </OrganizationProfileSection>

      <OrganizationProfileSection icon={FileTextIcon} title={t("about")}>
        <form.AppField name="industries">
          {() => <IndustriesField required={type === "company"} />}
        </form.AppField>
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <form.AppField name="country">
            {(field) => (
              <field.SelectField
                label={t("country")}
                requiredMark
                placeholder={t("countryPlaceholder")}
                options={countryCodes.map((value) => ({ value, label: countryName(value) }))}
              />
            )}
          </form.AppField>
          <form.AppField name="foundedYear">
            {(field) => (
              <field.TextField
                label={t("foundedYear")}
                requiredMark
                inputMode="numeric"
                maxLength={4}
                description={t(
                  type === "independent_builder" ? "foundedYearHint" : "foundedYearFormatHint",
                )}
              />
            )}
          </form.AppField>
        </div>
        <div className="flex flex-col gap-x-6 gap-y-6 sm:flex-row">
          <div className="sm:flex-1">
            <form.AppField name="description">
              {(field) => (
                <field.TextareaField
                  label={t("description")}
                  requiredMark
                  className="field-sizing-fixed h-28 resize-none"
                  maxLength={MAX_DESCRIPTION}
                  description={t("descriptionHint")}
                />
              )}
            </form.AppField>
          </div>
          <form.Field name="logoFileId">
            {(field) => (
              <Field className="sm:w-28 sm:shrink-0">
                <FieldLabel htmlFor="organization-logo">{t("logo.label")}</FieldLabel>
                <OrganizationLogoUpload value={field.state.value} onChange={field.handleChange} />
              </Field>
            )}
          </form.Field>
        </div>
      </OrganizationProfileSection>

      {admin && (
        <OrganizationProfileSection
          icon={ShieldCheckIcon}
          title={t("domain.title")}
          lead={t("domain.lead")}
        >
          <VerifiedDomainField
            id="organization-email-domain"
            domain={domain}
            label={t("domain.label")}
            hint={t("domain.hint")}
            problems={{ invalid: t("domain.invalid"), taken: t("domain.taken") }}
            disabled={pending}
          />
        </OrganizationProfileSection>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {/* Unsaved changes to a saved profile are dropped only after a question: Cancel asks here, LeaveGuard on leaving. */}
        {!organization && (
          <Button prominence="secondary" size="lg" href={siteRoutes.workspaceOrganization}>
            {t("cancel")}
          </Button>
        )}
        {onCancel && (
          <Button
            prominence="secondary"
            size="lg"
            disabled={pending}
            onClick={() => (dirty ? setDiscarding(true) : onCancel())}
          >
            {t("cancel")}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          pending={pending}
          disabled={organization !== undefined && !dirty}
          className="ml-auto"
        >
          {t(organization ? "save" : "create")}
        </Button>
      </div>
      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
      {onCancel && (
        <ConfirmDialog
          open={discarding}
          onOpenChange={setDiscarding}
          title={t("discard.title")}
          description={t("leave.lead")}
          confirmLabel={t("discard.confirm")}
          cancelLabel={t("discard.keep")}
          tone="danger"
          pending={false}
          onConfirm={onCancel}
        />
      )}
    </form>
  );
}

export { OrganizationForm };
