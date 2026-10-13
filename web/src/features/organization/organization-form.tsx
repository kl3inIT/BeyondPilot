"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Building2Icon, FileTextIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard, onGuardEntry } from "@/components/composites/leave-guard";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { focusFirstInvalidSoon } from "@/components/form/focus-first-invalid";
import { ChoiceCardsField } from "@/components/form/form-fields";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  createOrganization,
  createOrganizationFromBasics,
  saveAdminOrganization,
  saveMyOrganization,
  type Organization,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { siteRoutes } from "@/lib/site";

import { organizationTypes, teamSizes } from "./organization-codes";
import { ExistingOrganizations, useExistingOrganizations } from "./organization-existing";
import { MAX_DESCRIPTION, MAX_TEAM_BACKGROUND } from "./organization-format";
import { OrganizationIndustriesField } from "./organization-industries-field";
import { OrganizationLogoUpload } from "./organization-logo-upload";
import { OrganizationProfileSection } from "./organization-profile-section";
import {
  aloneBodyOf,
  createsAlone,
  creationSchema,
  givesCompanyFacts,
  profileBodyOf,
  profileRefusals,
  profileSchema,
  profileValuesOf,
} from "./organization-schemas";
import { useVerifiedDomain, VerifiedDomainField } from "./verified-domain";

/** Who a person may create an organization for, in the order the create page offers them. */
const creators = ["independent_builder", "builder_team", "company"] as const;

type OrganizationFormProps = {
  /** The organization to change; without one the form creates it. */
  organization?: Organization;
  /** The name a new organization starts from: what the person typed in the finder. */
  initialName?: string;
  /** The person's own name, which a new organization of one starts from. */
  ownName?: string;
  /** Set when an operator changes the organization: the form then also holds its verified domain. */
  admin?: boolean;
  /** Leaves a saved profile unchanged and closes the form. */
  onCancel?: () => void;
};

/**
 * The profile of an organization, as its owner writes it: to create one, or to change the one they
 * own. The backend decides what is valid; a member it rejects is marked here by its name. A new
 * organization is checked against those that exist when its name or its website is left, and what
 * may be the same one is named above the submit button, as a warning the person may pass.
 *
 * A new organization starts from who it is for. A builder on their own gives their name and their
 * country and writes the rest on the profile later; a team or a company gives the whole profile.
 */
function OrganizationForm({
  organization,
  initialName = "",
  ownName = "",
  admin,
  onCancel,
}: OrganizationFormProps) {
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

  const rules: ReturnType<typeof creationSchema> = organization
    ? profileSchema(t)
    : creationSchema(t);
  const form = useAppForm({
    defaultValues: organization
      ? profileValuesOf(organization)
      : { ...profileValuesOf(), name: initialName },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: rules },
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
          await (createsAlone(value.type)
            ? createOrganizationFromBasics({ body: aloneBodyOf(value) })
            : createOrganization({ body }));
          notify.success("Organization.done.created");
          const next = getPathname({ href: siteRoutes.workspaceOrganization, locale });
          // The entry the guard added to catch Back gives way to the organization's page.
          startLeaving(() => (onGuardEntry() ? router.replace(next) : router.push(next)));
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
          notify.failure(error);
        }
      }
    },
  });

  const existing = useExistingOrganizations(() => form.state.isSubmitting);
  const type = useStore(form.store, (state) => state.values.type);
  // A company gives its website, its industries and the year it started; anyone else may.
  const company = givesCompanyFacts(type);
  // A new organization of one asks for a name and a country, and nothing else.
  const alone = !organization && createsAlone(type);
  const name = useStore(form.store, (state) => state.values.name);
  const pending = useStore(form.store, (state) => state.isSubmitting) || leaving;
  const changed =
    useStore(form.store, (state) => !state.isDefaultValue) ||
    domain.text !== (organization?.emailDomain ?? "");
  // What a leave would lose: a saved profile's changes, or what was typed into a new one.
  const dirty = !pending && changed;
  // A saved profile has nothing to save until it differs from what was saved.
  const unchanged = organization !== undefined && !pending && !changed;

  const country = (
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
  );

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

      {!organization && (
        <form.AppField
          name="type"
          listeners={{
            onChange: ({ value, fieldApi }) => {
              // The name follows the choice while it is still the one the page filled in.
              const written = fieldApi.form.getFieldValue("name").trim();
              const mine = createsAlone(value);
              if (written === (mine ? initialName : ownName).trim()) {
                fieldApi.form.setFieldValue("name", mine ? ownName : initialName);
              }
            },
          }}
        >
          {() => (
            <ChoiceCardsField
              label={t("creator.label")}
              note={alone && name.trim() ? t("creator.aloneNote", { name: name.trim() }) : null}
              options={creators.map((value) => ({
                value,
                label: t(`creator.${value}.title`),
                what: t(`creator.${value}.what`),
              }))}
            />
          )}
        </form.AppField>
      )}

      <OrganizationProfileSection icon={Building2Icon} title={t("basics")}>
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <form.AppField
            name="name"
            listeners={
              organization || alone
                ? undefined
                : { onBlur: ({ value }) => existing.checkName(value) }
            }
          >
            {(field) => (
              <field.TextField
                label={t(alone ? "ownName" : "name")}
                requiredMark
                autoComplete={alone ? "name" : "organization"}
                maxLength={120}
              />
            )}
          </form.AppField>
          {alone && country}
          {!alone && (
            <form.AppField
              name="website"
              listeners={
                organization ? undefined : { onBlur: ({ value }) => existing.checkWebsite(value) }
              }
            >
              {(field) => (
                <field.TextField
                  label={t("website")}
                  requiredMark={company}
                  optional={!company}
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
          )}
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
        {!alone && (
          <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
            {/* A new organization says its type with the choice above. */}
            {organization && (
              <form.AppField name="type">
                {(field) => (
                  <field.SelectField
                    label={t("type")}
                    requiredMark
                    options={organizationTypes.map((value) => ({ value, label: typeName(value) }))}
                  />
                )}
              </form.AppField>
            )}
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
        )}
      </OrganizationProfileSection>

      {!alone && (
        <OrganizationProfileSection icon={FileTextIcon} title={t("about")}>
          <form.AppField name="industries">
            {() => <OrganizationIndustriesField required={company} />}
          </form.AppField>
          <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
            {country}
            <form.AppField name="foundedYear">
              {(field) => (
                <field.TextField
                  label={t("foundedYear")}
                  requiredMark={company}
                  optional={!company}
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
      )}

      {type === "builder_team" && (
        <form.AppField name="teamBackground">
          {(field) => (
            <field.TextareaField
              label={t("teamBackground")}
              description={t("teamBackgroundHint")}
              maxLength={MAX_TEAM_BACKGROUND}
              rows={4}
              requiredMark
            />
          )}
        </form.AppField>
      )}

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

      {!organization && !alone && (
        <div aria-live="polite" className="empty:hidden">
          {existing.matches.length > 0 && <ExistingOrganizations matches={existing.matches} />}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {/* Unsaved work is dropped only after a question: Cancel asks here on a saved profile, and LeaveGuard on leaving, which Cancel is on a new one. */}
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
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {/* Why the save is held, beside it. */}
          {unchanged && (
            <p id={`${form.formId}-unchanged`} className="text-sm text-muted-foreground">
              {t("unchanged")}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            pending={pending}
            disabled={organization !== undefined && !dirty}
            aria-describedby={unchanged ? `${form.formId}-unchanged` : undefined}
          >
            {t(organization ? "save" : "create")}
          </Button>
        </div>
      </div>
      <LeaveGuard
        active={dirty}
        back
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
