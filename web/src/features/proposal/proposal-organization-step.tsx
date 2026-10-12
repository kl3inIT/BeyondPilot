"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { useAppForm } from "@/components/form/app-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { organizeUseCaseProposal, type ProposingOrganization } from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

import { describeProposalError } from "./proposal-errors";
import { ProposalOrganizationDialog } from "./proposal-organization-dialog";

/** The sizes a team names. */
const teamSizes = ["2_9", "10_49", "50_99"] as const;

type ProposalOrganizationStepProps = {
  useCaseId: string;
  /** The organization the proposal is sent for; none yet for a person who belongs to no organization. */
  organization: ProposingOrganization | null;
  /** The name of the caller's account, for an organization of one person. */
  accountName: string;
};

/** The organization the proposal is sent for, or the few lines that make one for a person in none. */
function ProposalOrganizationStep({
  useCaseId,
  organization,
  accountName,
}: ProposalOrganizationStepProps) {
  if (!organization) {
    return <NewOrganization useCaseId={useCaseId} accountName={accountName} />;
  }

  return <OrganizationCard organization={organization} />;
}

type OrganizationCardProps = { organization: ProposingOrganization };

/** The organization the proposal is sent for, with the way for its owner to correct what they gave when they made it. */
function OrganizationCard({ organization }: OrganizationCardProps) {
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

type Kind = "individual" | "team";

/**
 * Makes the organization a person sends the proposal for: themselves on their own, or their team. It waits
 * for GenAI Fund's review, which does not hold the proposal up.
 */
function NewOrganization({
  useCaseId,
  accountName,
}: Omit<ProposalOrganizationStepProps, "organization">) {
  const t = useTranslations("UseCaseProposal.wizard.organization");
  const notify = useNotify();
  const router = useRouter();
  const countryName = useCountryName();
  const sizeName = useVocabulary("teamSize");
  // The answer is a page read again; until it arrives the form stays as sent.
  const [created, setCreated] = useState(false);

  const form = useAppForm({
    defaultValues: { kind: "individual" as Kind, name: "", country: "", size: "2_9", website: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z
        .object({
          kind: z.enum(["individual", "team"]),
          name: z.string(),
          country: z.string(),
          size: z.string(),
          website: z.string(),
        })
        // A person on their own is named by their account; only a team has a name to give.
        .superRefine((value, context) => {
          if (value.kind === "team" && value.name.trim() === "") {
            context.addIssue({ code: "custom", path: ["name"], message: t("required") });
          }
          if (value.country === "") {
            context.addIssue({ code: "custom", path: ["country"], message: t("required") });
          }
        }),
    },
    onSubmit: async ({ value }) => {
      try {
        await organizeUseCaseProposal({
          path: { useCaseId },
          body:
            value.kind === "team"
              ? {
                  kind: "team",
                  name: value.name.trim(),
                  country: value.country,
                  teamSize: value.size as "2_9",
                  website: value.website.trim() || null,
                }
              : { kind: "individual", name: accountName, country: value.country },
        });
        setCreated(true);
        router.refresh();
      } catch (error) {
        notify.error(describeProposalError(error));
      }
    },
  });
  const team = useStore(form.store, (state) => state.values.kind === "team");
  const submitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="kind">
        {(field) => (
          <RadioGroup
            value={field.state.value}
            onValueChange={(value) => field.handleChange(value as Kind)}
            aria-label={t("kind")}
          >
            {(["individual", "team"] as const).map((choice) => (
              <FieldLabel key={choice} htmlFor={`proposal-kind-${choice}`}>
                <Field orientation="horizontal">
                  <span className="text-sm font-medium">{t(choice)}</span>
                  <RadioGroupItem value={choice} id={`proposal-kind-${choice}`} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        )}
      </form.Field>

      {team && (
        <form.AppField name="name">
          {(field) => <field.TextField label={t("teamName")} maxLength={120} />}
        </form.AppField>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="country">
          {(field) => {
            const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="proposal-country">{t("country")}</FieldLabel>
                <NativeSelect
                  id="proposal-country"
                  className="w-full"
                  value={field.state.value}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? "proposal-country-error" : undefined}
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
                {invalid && <FieldError id="proposal-country-error">{t("required")}</FieldError>}
              </Field>
            );
          }}
        </form.Field>
        {team && (
          <form.Field name="size">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="proposal-team-size">{t("teamSize")}</FieldLabel>
                <NativeSelect
                  id="proposal-team-size"
                  className="w-full"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                >
                  {teamSizes.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {sizeName(option)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form.Field>
        )}
      </div>

      {team && (
        <form.AppField name="website">
          {(field) => (
            <field.TextField label={t("website")} type="url" inputMode="url" maxLength={300} />
          )}
        </form.AppField>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <TextButton href={siteRoutes.workspaceOrganization}>{t("existing")}</TextButton>
        <Button type="submit" size="lg" pending={submitting || created}>
          {t("continue")}
        </Button>
      </div>
    </form>
  );
}

export { ProposalOrganizationStep };
