"use client";

import { useStore } from "@tanstack/react-form";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { ReviewStatus } from "@/components/composites/review-status";
import { useNotify } from "@/hooks/use-notify";
import { withdrawJoinRequest } from "@/lib/api/generated";
import { useRouter } from "next/navigation";
import { TextButton } from "@/components/actions/text-button";
import { withFieldGroup } from "@/components/form/app-form";
import { useFieldValidity } from "@/components/form/form-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { OrganizationFinder } from "@/features/organization/organization-finder";
import { countryCodes, useCountryName } from "@/i18n/vocabulary";
import type {
  OrganizationJoinRequest,
  OrganizationMatch,
  ProposingOrganization,
} from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

import { maxBackground } from "./proposal-draft";
import { ProposalOrganizationDialog } from "./proposal-organization-dialog";
import { phoneSchema } from "./proposal-schemas";

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
 * Organization first: find or create it, or withdraw a pending request. Once a member, the person
 * sees the organization and their contact fields. A team also supplies the proposal's background.
 */
const ProposalYouStep = withFieldGroup({
  defaultValues: {
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
    const country = useStore(group.store, (state) => state.values.country);
    const [creating, setCreating] = useState<string | null>(null);

    const team = organization?.type === "builder_team";

    return (
      <div className="flex flex-col gap-6">
        {organization && <OrganizationSummary organization={organization} onSaved={onOrganized} />}

        {!organization && request && (
          <div className="flex flex-col gap-1 rounded-lg border p-4">
            <p className="text-sm font-medium">{request.organizationName}</p>
            <p className="text-sm text-muted-foreground">
              {t(request.claim ? "claiming" : "asked", { name: request.organizationName })}
            </p>
            <WithdrawRequest onOrganized={onOrganized} />
          </div>
        )}

        {!organization && !request && (
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

        {team && (
          <group.AppField name="teamBackground">
            {(field) => (
              <field.TextareaField label={t("teamBackground")} rows={4} maxLength={maxBackground} />
            )}
          </group.AppField>
        )}

        {organization && (
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

/** The organization the proposal is sent for, with the way for its owner to correct what they gave. */
function OrganizationSummary({
  organization,
  onSaved,
}: {
  organization: ProposingOrganization;
  onSaved: () => Promise<void>;
}) {
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
      {!organization.approved && (
        <ReviewStatus state="in_review" appearance="pill">
          {t("pending")}
        </ReviewStatus>
      )}
      {organization.owner && (
        <>
          <TextButton onClick={() => setEditing(true)}>{t("edit")}</TextButton>
          <ProposalOrganizationDialog open={editing} onOpenChange={setEditing} onSaved={onSaved} />
        </>
      )}
    </div>
  );
}

/** A pending membership request can be withdrawn without discarding the proposal's values. */
function WithdrawRequest({ onOrganized }: { onOrganized: () => Promise<void> }) {
  const t = useTranslations("Organization");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  async function withdraw() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await withdrawJoinRequest();
      await onOrganized();
      router.refresh();
      notify.success("Organization.done.requestWithdrawn");
    } catch (error) {
      notify.failure(error);
    } finally {
      running.current = false;
      setPending(false);
    }
  }
  return (
    <Button prominence="secondary" pending={pending} onClick={withdraw}>
      {t("entry.request.withdraw")}
    </Button>
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
