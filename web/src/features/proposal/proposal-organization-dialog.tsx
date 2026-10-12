"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { FormDialog } from "@/components/composites/form-dialog";
import { RequiredMark } from "@/components/composites/required-mark";
import { useAppForm } from "@/components/form/app-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  industries,
  organizationTypes,
  teamSizes,
} from "@/features/organization/organization-codes";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  getMyOrganization,
  saveMyOrganizationBasics,
  type Organization,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

type ProposalOrganizationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Corrects what a person gave when they made their organization, over the proposal: the name, the kind, the size,
 * the industries and the country. The rest of the profile is written on the organization's own page, which the
 * dialog points to so nothing is changed behind the person's back.
 */
function ProposalOrganizationDialog({ open, onOpenChange }: ProposalOrganizationDialogProps) {
  const t = useTranslations("UseCaseProposal.wizard.organization.dialog");
  const notify = useNotify();
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let current = true;
    getMyOrganization().then(
      ({ data }) => {
        if (current && data.organization) {
          setOrganization(data.organization);
        }
      },
      (error) => {
        if (current) {
          notify.failure(error);
          onOpenChange(false);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [open, notify, onOpenChange]);

  if (!organization) {
    // The facts are read first, so the form opens with them.
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <BasicsForm
      key={`${organization.id}-${organization.version}`}
      organization={organization}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

type BasicsFormProps = ProposalOrganizationDialogProps & { organization: Organization };

function BasicsForm({ organization, open, onOpenChange }: BasicsFormProps) {
  const t = useTranslations("UseCaseProposal.wizard.organization.dialog");
  const f = useTranslations("Organization.form");
  const notify = useNotify();
  const router = useRouter();
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const industryName = useVocabulary("industry");
  const countryName = useCountryName();

  const form = useAppForm({
    defaultValues: {
      name: organization.name,
      type: organization.type as string,
      teamSize: (organization.teamSize ?? "2_9") as string,
      industries: organization.industries as string[],
      country: organization.country ?? "",
    },
    onSubmit: async ({ value }) => {
      try {
        await saveMyOrganizationBasics({
          body: {
            name: value.name.trim(),
            type: value.type as Organization["type"],
            teamSize: value.teamSize as NonNullable<Organization["teamSize"]>,
            industries: value.industries as Organization["industries"],
            country: value.country,
          },
        });
        notify.success("UseCaseProposal.wizard.organization.dialog.saved");
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        notify.failure(error);
      }
    },
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      title={t("title")}
      width="md"
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
    >
      <FieldGroup>
        <form.AppField
          name="name"
          validators={{
            onSubmit: ({ value }) => (value.trim() === "" ? t("required") : undefined),
          }}
        >
          {(field) => <field.TextField label={f("name")} maxLength={120} requiredMark />}
        </form.AppField>
        <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
          <form.AppField
            name="type"
            listeners={{
              onChange: ({ value, fieldApi }) => {
                // A builder on their own is a team of one; a team is at least two.
                const size = fieldApi.form.getFieldValue("teamSize");
                if (value === "independent_builder") {
                  fieldApi.form.setFieldValue("teamSize", "just_me");
                } else if (size === "just_me") {
                  fieldApi.form.setFieldValue("teamSize", "2_9");
                }
              },
            }}
          >
            {(field) => (
              <field.SelectField
                label={f("type")}
                requiredMark
                options={organizationTypes.map((value) => ({ value, label: typeName(value) }))}
              />
            )}
          </form.AppField>
          <form.AppField name="teamSize">
            {(field) => (
              <field.SelectField
                label={f("teamSize")}
                requiredMark
                options={teamSizes.map((value) => ({ value, label: sizeName(value) }))}
              />
            )}
          </form.AppField>
        </div>
        <form.AppField
          name="industries"
          validators={{
            onChangeListenTo: ["type"],
            onChange: ({ value, fieldApi }) =>
              fieldApi.form.getFieldValue("type") === "company" && value.length === 0
                ? f("industriesRequired")
                : undefined,
          }}
        >
          {(field) => {
            const company = form.getFieldValue("type") === "company";
            const error = field.state.meta.errors.find((entry) => typeof entry === "string");
            return (
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="proposal-organization-industries">
                  {f("industries")} {company && <RequiredMark />}
                </FieldLabel>
                <ChoiceCombobox
                  id="proposal-organization-industries"
                  label={f("industries")}
                  placeholder={f("industriesPlaceholder")}
                  emptyLabel={f("industriesEmpty")}
                  removeLabel={(industry) => f("industriesRemove", { industry })}
                  aria-invalid={error ? true : undefined}
                  aria-required={company || undefined}
                  options={industries.map((value) => ({ value, label: industryName(value) }))}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  max={5}
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>
            );
          }}
        </form.AppField>
        <form.AppField
          name="country"
          validators={{ onSubmit: ({ value }) => (value === "" ? t("required") : undefined) }}
        >
          {(field) => (
            <field.SelectField
              label={f("country")}
              requiredMark
              options={countryCodes.map((code) => ({ value: code, label: countryName(code) }))}
            />
          )}
        </form.AppField>
        <TextButton
          className="self-start"
          href={siteRoutes.workspaceOrganization}
          target="_blank"
          rel="noreferrer"
        >
          {t("more")}
        </TextButton>
      </FieldGroup>
    </FormDialog>
  );
}

export { ProposalOrganizationDialog };
