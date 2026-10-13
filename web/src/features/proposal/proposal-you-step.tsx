"use client";

import { useStore } from "@tanstack/react-form";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { withFieldGroup } from "@/components/form/app-form";
import { useFieldValidity } from "@/components/form/form-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OrganizationFinder } from "@/features/organization/organization-finder";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type {
  OrganizationJoinRequest,
  OrganizationMatch,
  ProposingOrganization,
} from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

import { maxBackground, whoOf, type Who } from "./proposal-draft";
import { ProposalOrganizationDialog } from "./proposal-organization-dialog";
import { phoneSchema } from "./proposal-schemas";

/** The sizes a team names. */
const teamSizes = ["2_9", "10_49", "50_99"] as const;

const choices = ["individual", "team", "company"] as const;

type ProposalYouStepProps = {
  /** The organization the proposal is sent for; none yet for a person who belongs to none. */
  organization: ProposingOrganization | null;
  /** The organization of the caller's email domain, offered in the search before anything is typed. */
  suggestion: OrganizationMatch | null;
  /** The request to join an organization that the caller waits on. */
  request: OrganizationJoinRequest | null;
  /** The address of the account, which is not changed here. */
  email: string;
  /** Reads what joining or creating an organization made of the person. */
  onOrganized: () => Promise<void>;
};

/**
 * Who sends the proposal and how to reach them: one of three horizontal choices, then what the choice
 * asks. A person already in an organization has their choice made and sees the organization; a person in
 * none finds a company, makes one or writes their team. The team says what it has done, and the person
 * says who they are.
 */
const ProposalYouStep = withFieldGroup({
  defaultValues: {
    who: "",
    teamName: "",
    teamSize: "2_9",
    teamBackground: "",
    name: "",
    country: "",
    phone: "",
  },
  props: {
    organization: null,
    suggestion: null,
    request: null,
    email: "",
    onOrganized: () => Promise.resolve(),
  } as ProposalYouStepProps,
  render: function ProposalYouStepRender({
    group,
    organization,
    suggestion,
    request,
    email,
    onOrganized,
  }) {
    const t = useTranslations("UseCaseProposal.wizard.you");
    const d = useTranslations("UseCaseProposal.wizard.details");
    const sizeName = useVocabulary("teamSize");
    const chosen = useStore(group.store, (state) => state.values.who);
    const country = useStore(group.store, (state) => state.values.country);
    const [creating, setCreating] = useState<string | null>(null);

    const locked = organization !== null || request !== null;
    const who = (organization ? whoOf(organization.type) : request ? "company" : chosen) as
      Who | "";
    const team = who === "team";

    return (
      <div className="flex flex-col gap-6">
        <group.AppField name="who">{() => <WhoCards value={who} locked={locked} />}</group.AppField>

        {organization && <OrganizationSummary organization={organization} />}

        {!organization && request && (
          <div className="flex flex-col gap-1 rounded-lg border p-4">
            <p className="text-sm font-medium">{request.organizationName}</p>
            <p className="text-sm text-muted-foreground">
              {t(request.claim ? "claiming" : "asked", { name: request.organizationName })}
            </p>
          </div>
        )}

        {!organization && !request && who === "company" && (
          <>
            <OrganizationFinder
              embedded
              suggestion={suggestion}
              onAnswered={onOrganized}
              onCreate={setCreating}
            />
            <ProposalOrganizationDialog
              open={creating !== null}
              onOpenChange={(open) => setCreating(open ? creating : null)}
              create={{ name: creating ?? "", country, onCreated: onOrganized }}
            />
          </>
        )}

        {!organization && who === "team" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <group.AppField name="teamName">
              {(field) => <field.TextField label={t("teamName")} maxLength={120} />}
            </group.AppField>
            <group.AppField name="teamSize">
              {(field) => (
                <field.SelectField
                  label={t("teamSize")}
                  options={teamSizes.map((value) => ({ value, label: sizeName(value) }))}
                />
              )}
            </group.AppField>
          </div>
        )}

        {team && (
          <group.AppField name="teamBackground">
            {(field) => (
              <field.TextareaField label={t("teamBackground")} rows={4} maxLength={maxBackground} />
            )}
          </group.AppField>
        )}

        {(organization || who === "individual" || who === "team") && (
          <FieldSet>
            <FieldLegend>{t("aboutYou")}</FieldLegend>
            <div className="grid gap-5 sm:grid-cols-2">
              <group.AppField name="name">
                {(field) => (
                  <field.TextField label={d("name")} autoComplete="name" maxLength={120} />
                )}
              </group.AppField>
              <Field>
                <FieldLabel htmlFor="proposal-email">{d("email")}</FieldLabel>
                <Input id="proposal-email" value={email} readOnly disabled />
              </Field>
              <group.AppField name="country">{() => <CountryField />}</group.AppField>
              {/* A number that cannot be one is said while it is typed, before the step is left. */}
              <group.AppField
                name="phone"
                validators={{ onChange: phoneSchema(() => d("phoneInvalid")) }}
              >
                {(field) => (
                  <field.TextField
                    label={d("phone")}
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={40}
                    placeholder="+84 912 345 678"
                  />
                )}
              </group.AppField>
            </div>
          </FieldSet>
        )}
      </div>
    );
  },
});

/** Three choices side by side, all in view; a person in an organization sees theirs and cannot change it. */
function WhoCards({ value, locked }: { value: string; locked: boolean }) {
  const t = useTranslations("UseCaseProposal.wizard.you");
  const { field, invalid, errors, ids } = useFieldValidity<string>();

  return (
    <FieldSet data-invalid={invalid || undefined}>
      <FieldLegend variant="label">{t("who")}</FieldLegend>
      <RadioGroup
        id={ids.control}
        className="sm:grid-cols-3"
        value={value}
        disabled={locked}
        onValueChange={(next) => field.handleChange(String(next))}
        aria-label={t("who")}
        aria-describedby={invalid ? ids.error : undefined}
      >
        {choices.map((choice) => (
          <FieldLabel key={choice} htmlFor={`${ids.control}-${choice}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{t(`choice.${choice}.title`)}</FieldTitle>
                <FieldDescription>{t(`choice.${choice}.what`)}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={choice}
                id={`${ids.control}-${choice}`}
                aria-invalid={invalid || undefined}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      {invalid && <FieldError id={ids.error} errors={errors} />}
    </FieldSet>
  );
}

/** The organization the proposal is sent for, with the way for its owner to correct what they gave. */
function OrganizationSummary({ organization }: { organization: ProposingOrganization }) {
  const t = useTranslations("UseCaseProposal.wizard.organization");
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <Avatar size="lg">
        {organization.logoFileId && (
          <AvatarImage src={publicFileUrl(organization.logoFileId)} alt="" />
        )}
        <AvatarFallback>{initials(organization.name, "")}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-base font-medium">{organization.name}</span>
      {!organization.approved && <Badge variant="secondary">{t("pending")}</Badge>}
      {organization.owner && (
        <>
          <TextButton onClick={() => setEditing(true)}>{t("edit")}</TextButton>
          <ProposalOrganizationDialog open={editing} onOpenChange={setEditing} />
        </>
      )}
    </div>
  );
}

/** The country, in the browser's own list so a phone shows its picker. */
function CountryField() {
  const t = useTranslations("UseCaseProposal.wizard.details");
  const countryName = useCountryName();
  const { field, invalid, errors, ids } = useFieldValidity<string>();

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={ids.control}>{t("country")}</FieldLabel>
      <NativeSelect
        id={ids.control}
        name={field.name}
        className="w-full"
        autoComplete="country"
        value={field.state.value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? ids.error : undefined}
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
      {invalid && <FieldError id={ids.error} errors={errors} />}
    </Field>
  );
}

export { ProposalYouStep };
