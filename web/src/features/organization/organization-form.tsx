"use client";

import { Building2Icon, FileTextIcon, ShieldCheckIcon, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { ChoiceSelect } from "@/components/composites/choice-select";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  createOrganization,
  saveAdminOrganization,
  saveMyOrganization,
  type Organization,
  type SaveOrganization,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { focusField } from "@/lib/focus-field";
import { siteRoutes } from "@/lib/site";

import { industries, organizationTypes, teamSizes } from "./organization-codes";
import { organizationError } from "./organization-errors";
import { useVerifiedDomain, VerifiedDomainField } from "./verified-domain";

/** The longest description the backend takes. */
const MAX_DESCRIPTION = 280;
/** The years the backend takes for when an organization started. */
const FIRST_YEAR = 1800;
const LAST_YEAR = 2100;
/** The most industries the backend takes. */
const MAX_INDUSTRIES = 5;

/** The fields the form checks before it asks the backend, in the order the page shows them. */
const checkedFields = [
  { name: "jobTitle", id: "organization-job-title" },
  { name: "name", id: "organization-name" },
  { name: "website", id: "organization-website" },
  { name: "teamSize", id: "organization-team-size" },
  { name: "industries", id: "organization-industries" },
  { name: "country", id: "organization-country" },
  { name: "foundedYear", id: "organization-founded-year" },
  { name: "description", id: "organization-description" },
  { name: "logoUrl", id: "organization-logo-url" },
] as const;

/** The year written in the field when it is one the backend takes; otherwise null. */
function yearOf(text: string) {
  const year = Number(text);
  return /^\d{4}$/.test(text.trim()) && year >= FIRST_YEAR && year <= LAST_YEAR ? year : null;
}

/** A group of related fields on a tinted panel, with what the group is about under its title. */
function FormSection({
  icon: Icon,
  title,
  lead,
  children,
}: {
  icon: LucideIcon;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-2xl border bg-muted p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-primary" aria-hidden="true" />
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

type OrganizationFormProps = {
  /** The organization to change; without one the form creates it. */
  organization?: Organization;
  /** Set when an operator changes the organization: the form then also holds its verified domain. */
  admin?: boolean;
};

/**
 * The profile of an organization, as its owner writes it: to create one, or to change the one they
 * own. The backend decides what is valid; a member it rejects is marked here by its name.
 */
function OrganizationForm({ organization, admin }: OrganizationFormProps) {
  const t = useTranslations("Organization.form");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  const [name, setName] = useState(organization?.name ?? "");
  const [type, setType] = useState<Organization["type"]>(organization?.type ?? "company");
  const [country, setCountry] = useState(organization?.country ?? "");
  const [teamSize, setTeamSize] = useState<string>(organization?.teamSize ?? "");
  const [chosenIndustries, setChosenIndustries] = useState<string[]>(
    organization?.industries ?? [],
  );
  const [jobTitle, setJobTitle] = useState("");
  const [website, setWebsite] = useState(organization?.website ?? "");
  const [description, setDescription] = useState(organization?.description ?? "");
  const [foundedYear, setFoundedYear] = useState(String(organization?.foundedYear ?? ""));
  const [logoUrl, setLogoUrl] = useState(organization?.logoUrl ?? "");
  const domain = useVerifiedDomain(organization?.emailDomain);
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [discarding, setDiscarding] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = new Set<string>();
    if (!name.trim()) {
      missing.add("name");
    }
    if (!country) {
      missing.add("country");
    }
    if (!teamSize) {
      missing.add("teamSize");
    }
    if (chosenIndustries.length === 0) {
      missing.add("industries");
    }
    if (!organization && !jobTitle.trim()) {
      missing.add("jobTitle");
    }
    if (!website.trim()) {
      missing.add("website");
    }
    if (!description.trim()) {
      missing.add("description");
    }
    const year = yearOf(foundedYear);
    if (year === null) {
      missing.add("foundedYear");
    }
    setInvalid(missing);
    const emailDomain = admin ? domain.read() : null;
    if (missing.size > 0 || year === null || emailDomain === undefined) {
      focusField(checkedFields.find((field) => missing.has(field.name))?.id ?? checkedFields[0].id);
      return;
    }
    const body = {
      name,
      type,
      country,
      teamSize: teamSize as SaveOrganization["teamSize"],
      industries: chosenIndustries,
      website: website.trim(),
      description: description.trim(),
      foundedYear: year,
      logoUrl: logoUrl.trim() || null,
    };
    setPending(true);
    try {
      if (organization && admin) {
        await saveAdminOrganization({
          path: { id: organization.id },
          body: { profile: { ...body, version: organization.version }, emailDomain },
        });
        notify.success("Organization.done.saved");
        router.refresh();
        setPending(false);
      } else if (organization) {
        await saveMyOrganization({ body: { ...body, version: organization.version } });
        notify.success("Organization.done.saved");
        router.refresh();
        setPending(false);
      } else {
        await createOrganization({ body: { ...body, jobTitle } });
        notify.success("Organization.done.created");
        // The new organization opens on its own pages; the form stays pending until they arrive.
        router.push(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
      }
    } catch (error) {
      setInvalid(rejectedFields(error));
      // A domain another organization has is said at its field; anything else in a toast.
      if (!domain.refused(error)) {
        notify.error(organizationError(error));
      }
      setPending(false);
    }
  }

  const bad = (field: string) => invalid.has(field) || undefined;

  function discard() {
    if (!organization) {
      return;
    }
    setName(organization.name);
    setType(organization.type);
    setCountry(organization.country ?? "");
    setTeamSize(organization.teamSize ?? "");
    setChosenIndustries(organization.industries);
    setWebsite(organization.website ?? "");
    setDescription(organization.description ?? "");
    setFoundedYear(String(organization.foundedYear ?? ""));
    setLogoUrl(organization.logoUrl ?? "");
    domain.change(organization.emailDomain ?? "");
    setInvalid(new Set());
    setDiscarding(false);
  }
  // Only a saved profile can differ from what was saved; a new one has nothing to lose yet.
  const dirty =
    organization !== undefined &&
    !pending &&
    JSON.stringify([
      name,
      type,
      country,
      teamSize,
      chosenIndustries,
      website,
      description,
      foundedYear,
      logoUrl,
      domain.text,
    ]) !==
      JSON.stringify([
        organization.name,
        organization.type,
        organization.country ?? "",
        organization.teamSize ?? "",
        organization.industries,
        organization.website ?? "",
        organization.description ?? "",
        String(organization.foundedYear ?? ""),
        organization.logoUrl ?? "",
        organization.emailDomain ?? "",
      ]);

  // The form's title is the page's on the create page; on the profile it sits under the organization's name.
  const Title = organization ? "h2" : "h1";
  // A field that is not marked may stay empty.
  const required = (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
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
        <Field data-invalid={bad("jobTitle")}>
          <FieldLabel htmlFor="organization-job-title">
            {t("jobTitle")} {required}
          </FieldLabel>
          <Input
            id="organization-job-title"
            name="jobTitle"
            autoComplete="organization-title"
            maxLength={120}
            value={jobTitle}
            aria-describedby="organization-job-title-hint"
            onChange={(event) => setJobTitle(event.target.value)}
            aria-invalid={bad("jobTitle")}
          />
          {bad("jobTitle") && <FieldError>{t("jobTitleRequired")}</FieldError>}
          <p id="organization-job-title-hint" className="text-xs text-muted-foreground">
            {t("jobTitleHint")}
          </p>
        </Field>
      )}

      <FormSection icon={Building2Icon} title={t("basics")} lead={t("basicsLead")}>
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <Field data-invalid={bad("name")}>
            <FieldLabel htmlFor="organization-name">
              {t("name")} {required}
            </FieldLabel>
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
              {t("website")} {required}
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
              aria-describedby="organization-website-hint"
              onChange={(event) => setWebsite(event.target.value)}
              aria-invalid={bad("website")}
            />
            {bad("website") && <FieldError>{t("websiteInvalid")}</FieldError>}
            <p id="organization-website-hint" className="text-xs text-muted-foreground">
              {t("websiteHint")}
            </p>
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
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="organization-type">
              {t("type")} {required}
            </FieldLabel>
            <ChoiceSelect
              id="organization-type"
              options={organizationTypes.map((value) => ({ value, label: typeName(value) }))}
              value={type}
              onValueChange={(value) => setType(value as Organization["type"])}
            />
          </Field>
          <Field data-invalid={bad("teamSize")}>
            <FieldLabel htmlFor="organization-team-size">
              {t("teamSize")} {required}
            </FieldLabel>
            <ChoiceSelect
              id="organization-team-size"
              placeholder={t("teamSizePlaceholder")}
              options={teamSizes.map((value) => ({ value, label: sizeName(value) }))}
              value={teamSize}
              onValueChange={setTeamSize}
              aria-invalid={bad("teamSize")}
            />
            {bad("teamSize") && <FieldError>{t("teamSizeRequired")}</FieldError>}
          </Field>
        </div>
      </FormSection>

      <FormSection icon={FileTextIcon} title={t("about")} lead={t("aboutLead")}>
        <Field data-invalid={bad("industries")}>
          <FieldLabel htmlFor="organization-industries">
            {t("industries")} {required}
          </FieldLabel>
          <ChoiceCombobox
            id="organization-industries"
            label={t("industries")}
            placeholder={t("industriesPlaceholder")}
            emptyLabel={t("industriesEmpty")}
            removeLabel={(industry) => t("industriesRemove", { industry })}
            aria-describedby="organization-industries-hint"
            aria-invalid={bad("industries")}
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
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <Field data-invalid={bad("country")}>
            <FieldLabel htmlFor="organization-country">
              {t("country")} {required}
            </FieldLabel>
            <ChoiceSelect
              id="organization-country"
              placeholder={t("countryPlaceholder")}
              options={countryCodes.map((value) => ({ value, label: countryName(value) }))}
              value={country}
              onValueChange={setCountry}
              aria-invalid={bad("country")}
            />
            {bad("country") && <FieldError>{t("countryRequired")}</FieldError>}
          </Field>
          <Field data-invalid={bad("foundedYear")}>
            <FieldLabel htmlFor="organization-founded-year">
              {t("foundedYear")} {required}
            </FieldLabel>
            <Input
              id="organization-founded-year"
              name="foundedYear"
              inputMode="numeric"
              maxLength={4}
              placeholder="2021"
              value={foundedYear}
              aria-describedby="organization-founded-year-hint"
              onChange={(event) => setFoundedYear(event.target.value)}
              aria-invalid={bad("foundedYear")}
            />
            {bad("foundedYear") && <FieldError>{t("foundedYearInvalid")}</FieldError>}
            <p id="organization-founded-year-hint" className="text-xs text-muted-foreground">
              {t("foundedYearHint")}
            </p>
          </Field>
        </div>
        <Field data-invalid={bad("description")}>
          <FieldLabel htmlFor="organization-description">
            {t("description")} {required}
          </FieldLabel>
          <Textarea
            id="organization-description"
            rows={4}
            maxLength={MAX_DESCRIPTION}
            value={description}
            aria-describedby="organization-description-hint"
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={bad("description")}
          />
          {bad("description") && <FieldError>{t("descriptionRequired")}</FieldError>}
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <p id="organization-description-hint">{t("descriptionHint")}</p>
            <span className="shrink-0 tabular-nums">
              {t("counter", { count: description.length, max: MAX_DESCRIPTION })}
            </span>
          </div>
        </Field>
        <Field data-invalid={bad("logoUrl")}>
          <FieldLabel htmlFor="organization-logo-url">{t("logoUrl")}</FieldLabel>
          <Input
            id="organization-logo-url"
            name="logoUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            maxLength={300}
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            aria-invalid={bad("logoUrl")}
          />
          {bad("logoUrl") && <FieldError>{t("websiteInvalid")}</FieldError>}
        </Field>
      </FormSection>

      {admin && (
        <FormSection icon={ShieldCheckIcon} title={t("domain.title")} lead={t("domain.lead")}>
          <VerifiedDomainField
            id="organization-email-domain"
            domain={domain}
            label={t("domain.label")}
            hint={t("domain.hint")}
            problems={{ invalid: t("domain.invalid"), taken: t("domain.taken") }}
            disabled={pending}
          />
        </FormSection>
      )}

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
