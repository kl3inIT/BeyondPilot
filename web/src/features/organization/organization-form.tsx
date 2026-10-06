"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ChoiceChips } from "@/components/composites/choice-chips";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  createOrganization,
  saveMyOrganization,
  type Organization,
  type SaveOrganization,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { focusField } from "@/lib/focus-field";
import { siteRoutes } from "@/lib/site";

import { industries, organizationRoles, organizationTypes, teamSizes } from "./organization-codes";
import { organizationError } from "./organization-errors";

/** The longest description the backend takes. */
const MAX_DESCRIPTION = 2000;
/** The most industries the backend takes. */
const MAX_INDUSTRIES = 5;

/** The fields the form checks before it asks the backend, in the order the page shows them. */
const checkedFields = [
  { name: "name", id: "organization-name" },
  { name: "teamSize", id: "organization-team-size" },
  { name: "roles", id: "organization-roles" },
  { name: "industries", id: "organization-industries" },
  { name: "country", id: "organization-country" },
] as const;

type OrganizationFormProps = {
  /** The organization to change; without one the form creates it. */
  organization?: Organization;
};

/**
 * The profile of an organization, as its owner writes it: to create one, or to change the one they
 * own. The backend decides what is valid; a member it rejects is marked here by its name.
 */
function OrganizationForm({ organization }: OrganizationFormProps) {
  const t = useTranslations("Organization.form");
  const roleName = useVocabulary("organizationRole");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  const [name, setName] = useState(organization?.name ?? "");
  const [roles, setRoles] = useState<string[]>(organization?.roles ?? []);
  const [type, setType] = useState<Organization["type"]>(organization?.type ?? "company");
  const [country, setCountry] = useState(organization?.country ?? "");
  const [teamSize, setTeamSize] = useState<string>(organization?.teamSize ?? "");
  const [chosenIndustries, setChosenIndustries] = useState<string[]>(
    organization?.industries ?? [],
  );
  const [jobTitle, setJobTitle] = useState("");
  const [website, setWebsite] = useState(organization?.website ?? "");
  const [description, setDescription] = useState(organization?.description ?? "");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [discarding, setDiscarding] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = new Set<string>();
    if (!name.trim()) {
      missing.add("name");
    }
    if (roles.length === 0) {
      missing.add("roles");
    }
    if (!country) {
      missing.add("country");
    }
    if (!teamSize) {
      missing.add("teamSize");
    }
    // A company names its industries; a team or a builder on their own may not have settled on one.
    if (type === "company" && chosenIndustries.length === 0) {
      missing.add("industries");
    }
    setInvalid(missing);
    if (missing.size > 0) {
      focusField(checkedFields.find((field) => missing.has(field.name))?.id ?? checkedFields[0].id);
      return;
    }
    const body = {
      name,
      roles,
      type,
      country,
      teamSize: teamSize as SaveOrganization["teamSize"],
      industries: chosenIndustries,
      website: website.trim() || null,
      description: description.trim() || null,
    };
    setPending(true);
    try {
      if (organization) {
        await saveMyOrganization({ body: { ...body, version: organization.version } });
        notify.success("Organization.done.saved");
        router.refresh();
        setPending(false);
      } else {
        await createOrganization({ body: { ...body, jobTitle: jobTitle.trim() || null } });
        notify.success("Organization.done.created");
        // The new organization opens on its own pages; the form stays pending until they arrive.
        router.push(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
      }
    } catch (error) {
      setInvalid(rejectedFields(error));
      notify.error(organizationError(error));
      setPending(false);
    }
  }

  const bad = (field: string) => invalid.has(field) || undefined;

  function discard() {
    if (!organization) {
      return;
    }
    setName(organization.name);
    setRoles(organization.roles);
    setType(organization.type);
    setCountry(organization.country ?? "");
    setTeamSize(organization.teamSize ?? "");
    setChosenIndustries(organization.industries);
    setWebsite(organization.website ?? "");
    setDescription(organization.description ?? "");
    setInvalid(new Set());
    setDiscarding(false);
  }
  // Only a saved profile can differ from what was saved; a new one has nothing to lose yet.
  const dirty =
    organization !== undefined &&
    !pending &&
    JSON.stringify([
      name,
      roles,
      type,
      country,
      teamSize,
      chosenIndustries,
      website,
      description,
    ]) !==
      JSON.stringify([
        organization.name,
        organization.roles,
        organization.type,
        organization.country ?? "",
        organization.teamSize ?? "",
        organization.industries,
        organization.website ?? "",
        organization.description ?? "",
      ]);

  // The form's title is the page's on the create page; on the profile it sits under the organization's name.
  const Title = organization ? "h2" : "h1";
  const optional = (
    <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
  );

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-7 rounded-3xl border bg-card p-5 md:p-10"
    >
      <div className="flex flex-col gap-2">
        <Title className="text-3xl font-semibold tracking-title">
          {t(organization ? "profileTitle" : "createTitle")}
        </Title>
        <p className="text-muted-foreground">{t(organization ? "profileLead" : "createLead")}</p>
      </div>

      {!organization && (
        <Field>
          <FieldLabel htmlFor="organization-job-title">
            {t("jobTitle")}
            {optional}
          </FieldLabel>
          <Input
            id="organization-job-title"
            name="jobTitle"
            autoComplete="organization-title"
            maxLength={120}
            value={jobTitle}
            aria-describedby="organization-job-title-hint"
            onChange={(event) => setJobTitle(event.target.value)}
          />
          <p id="organization-job-title-hint" className="text-xs text-muted-foreground">
            {t("jobTitleHint")}
          </p>
        </Field>
      )}

      <h3 className="border-t pt-6 text-lg font-semibold">{t("basics")}</h3>
      <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
        <Field data-invalid={bad("name")}>
          <FieldLabel htmlFor="organization-name">{t("name")}</FieldLabel>
          <Input
            id="organization-name"
            name="name"
            autoComplete="organization"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={bad("name")}
          />
          {bad("name") && <FieldError>{t("nameRequired")}</FieldError>}
        </Field>
        <Field data-invalid={bad("website")}>
          <FieldLabel htmlFor="organization-website">
            {t("website")}
            {optional}
          </FieldLabel>
          <Input
            id="organization-website"
            name="website"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            maxLength={300}
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            aria-invalid={bad("website")}
          />
          {bad("website") && <FieldError>{t("websiteInvalid")}</FieldError>}
        </Field>
      </div>
      {organization?.emailDomain && (
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
      <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="organization-type">{t("type")}</FieldLabel>
          <NativeSelect
            id="organization-type"
            className="w-full"
            value={type}
            onChange={(event) => setType(event.target.value as Organization["type"])}
          >
            {organizationTypes.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {typeName(value)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={bad("teamSize")}>
          <FieldLabel htmlFor="organization-team-size">{t("teamSize")}</FieldLabel>
          <NativeSelect
            id="organization-team-size"
            className="w-full"
            value={teamSize}
            onChange={(event) => setTeamSize(event.target.value)}
            aria-invalid={bad("teamSize")}
          >
            <NativeSelectOption value="">{t("teamSizePlaceholder")}</NativeSelectOption>
            {teamSizes.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {sizeName(value)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {bad("teamSize") && <FieldError>{t("teamSizeRequired")}</FieldError>}
        </Field>
      </div>

      <h3 className="border-t pt-6 text-lg font-semibold">{t("about")}</h3>
      <Field data-invalid={bad("roles")}>
        <FieldLabel>{t("roles")}</FieldLabel>
        <ChoiceChips
          id="organization-roles"
          label={t("roles")}
          aria-describedby="organization-roles-hint"
          options={organizationRoles.map((value) => ({ value, label: roleName(value) }))}
          value={roles}
          onValueChange={setRoles}
        />
        {bad("roles") && <FieldError>{t("rolesRequired")}</FieldError>}
        <p id="organization-roles-hint" className="text-xs text-muted-foreground">
          {t("rolesHint")}
        </p>
      </Field>
      <Field data-invalid={bad("industries")}>
        <FieldLabel>
          {t("industries")}
          {type !== "company" && optional}
        </FieldLabel>
        <ChoiceChips
          id="organization-industries"
          label={t("industries")}
          aria-describedby="organization-industries-hint"
          options={industries.map((value) => ({ value, label: industryName(value) }))}
          value={chosenIndustries}
          onValueChange={setChosenIndustries}
          max={MAX_INDUSTRIES}
        />
        {bad("industries") && <FieldError>{t("industriesRequired")}</FieldError>}
        <p id="organization-industries-hint" className="text-xs text-muted-foreground">
          {t("industriesHint", { count: MAX_INDUSTRIES, chosen: chosenIndustries.length })}
        </p>
      </Field>
      <div className="grid gap-x-3 gap-y-7 sm:grid-cols-2">
        <Field data-invalid={bad("country")}>
          <FieldLabel htmlFor="organization-country">{t("country")}</FieldLabel>
          <NativeSelect
            id="organization-country"
            className="w-full"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            aria-invalid={bad("country")}
          >
            <NativeSelectOption value="">{t("countryPlaceholder")}</NativeSelectOption>
            {countryCodes.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {countryName(value)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {bad("country") && <FieldError>{t("countryRequired")}</FieldError>}
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="organization-description">
          {t("description")}
          {optional}
        </FieldLabel>
        <Textarea
          id="organization-description"
          rows={4}
          maxLength={MAX_DESCRIPTION}
          value={description}
          aria-describedby="organization-description-hint"
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
          <p id="organization-description-hint">{t("descriptionHint")}</p>
          <span className="shrink-0 tabular-nums">
            {t("counter", { count: description.length, max: MAX_DESCRIPTION })}
          </span>
        </div>
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {organization ? (
          <Button
            prominence="tertiary"
            size="lg"
            disabled={!dirty}
            onClick={() => setDiscarding(true)}
          >
            {t("discard")}
          </Button>
        ) : (
          <Button prominence="tertiary" size="lg" href={siteRoutes.workspaceOrganization}>
            {t("cancel")}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          pending={pending}
          disabled={organization !== undefined && !dirty}
        >
          {t(organization ? "save" : "create")}
        </Button>
      </div>
      {discarding && (
        <ConfirmDialog
          open
          onOpenChange={setDiscarding}
          title={t("confirmDiscard.title")}
          description={t("confirmDiscard.lead")}
          confirmLabel={t("discard")}
          cancelLabel={t("confirmDiscard.cancel")}
          tone="danger"
          pending={false}
          onConfirm={discard}
        />
      )}
      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
    </form>
  );
}

export { OrganizationForm };
