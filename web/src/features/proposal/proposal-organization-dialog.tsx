"use client";

import { useQuery } from "@tanstack/react-query";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { ArrowUpRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { TextButton } from "@/components/actions/text-button";
import { ChoiceCombobox } from "@/components/composites/choice-combobox";
import { FormDialog } from "@/components/composites/form-dialog";
import { RequiredMark } from "@/components/composites/required-mark";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
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
  createOrganizationFromBasics,
  getMyOrganization,
  saveMyOrganizationBasics,
  type Organization,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { MAX_TEAM_BACKGROUND } from "@/features/organization/organization-format";
import { basicsSchema } from "@/features/organization/organization-schemas";
import { siteRoutes } from "@/lib/site";

/** What a new organization starts from, and what happens once it is made. */
type NewOrganization = {
  name: string;
  country: string;
  onCreated: () => Promise<void>;
};

type ProposalOrganizationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Makes an organization in place of correcting the person's own. */
  create?: NewOrganization;
  onSaved?: () => Promise<void>;
};

/**
 * Corrects what a person gave when they made their organization, over the proposal: the name, the kind, the size,
 * the industries and the country, or makes the organization from the same facts. The rest of the profile is written
 * on the organization's own page, which the dialog points to so nothing is changed behind the person's back.
 */
function ProposalOrganizationDialog({
  open,
  onOpenChange,
  create,
  onSaved,
}: ProposalOrganizationDialogProps) {
  const t = useTranslations("UseCaseProposal.wizard.organization.dialog");
  const notify = useNotify();
  const query = useQuery({
    queryKey: ["organization", "mine", "proposal-dialog"],
    queryFn: async ({ signal }) => (await getMyOrganization({ signal })).data.organization ?? null,
    enabled: open && !create,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const organization = query.data;

  useEffect(() => {
    if (open && !create && query.error) {
      notify.failure(query.error);
      onOpenChange(false);
    }
  }, [open, create, query.error, notify, onOpenChange]);

  if (create) {
    return <BasicsForm key={create.name} create={create} open={open} onOpenChange={onOpenChange} />;
  }

  if (!organization || query.isFetching) {
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
      onSaved={onSaved}
    />
  );
}

type BasicsFormProps = ProposalOrganizationDialogProps & { organization?: Organization };

function BasicsForm({ organization, create, open, onOpenChange, onSaved }: BasicsFormProps) {
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
      name: organization?.name ?? create?.name ?? "",
      type: organization?.type ?? "company",
      teamSize: (organization?.teamSize ?? "2_9") as string,
      industries: (organization?.industries ?? []) as string[],
      country: organization?.country ?? create?.country ?? "",
      teamBackground: organization?.teamBackground ?? "",
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: basicsSchema(f) },
    onSubmit: async ({ value, formApi }) => {
      const body = {
        name: value.name.trim(),
        type: value.type as Organization["type"],
        teamSize: value.teamSize as NonNullable<Organization["teamSize"]>,
        industries: value.industries as Organization["industries"],
        country: value.country,
        teamBackground: value.type === "builder_team" ? value.teamBackground.trim() || null : null,
        version: organization?.version ?? null,
      };
      try {
        if (create) {
          await createOrganizationFromBasics({ body });
          notify.success("UseCaseProposal.wizard.organization.dialog.created");
          await create.onCreated();
          onOpenChange(false);
          router.refresh();
          return;
        }
        await saveMyOrganizationBasics({ body });
        notify.success("UseCaseProposal.wizard.organization.dialog.saved");
        await onSaved?.();
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        const fields = Object.fromEntries(
          [...rejectedFields(error)].map((field) => [
            field,
            { message: field === "teamBackground" ? f("teamBackgroundRequired") : t("required") },
          ]),
        );
        setServerErrors(formApi, { fields });
        notify.failure(error);
      }
    },
  });

  const type = useStore(form.store, (state) => state.values.type);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      title={create ? t("createTitle") : t("title")}
      width="md"
      submitLabel={create ? t("create") : t("save")}
      cancelLabel={t("cancel")}
    >
      <FieldGroup>
        <form.AppField name="name">
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
        <form.AppField name="industries">
          {(field) => {
            const company = type === "company";
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
        <form.AppField name="country">
          {(field) => (
            <field.SelectField
              label={f("country")}
              requiredMark
              options={countryCodes.map((code) => ({ value: code, label: countryName(code) }))}
            />
          )}
        </form.AppField>
        {type === "builder_team" && (
          <form.AppField name="teamBackground">
            {(field) => (
              <field.TextareaField
                label={f("teamBackground")}
                description={f("teamBackgroundHint")}
                rows={4}
                maxLength={MAX_TEAM_BACKGROUND}
                requiredMark
              />
            )}
          </form.AppField>
        )}
        <TextButton
          className="self-start"
          href={
            create ? `${siteRoutes.workspaceOrganization}/new` : siteRoutes.workspaceOrganization
          }
          target="_blank"
          rel="noreferrer"
        >
          {create ? t("full") : t("more")}
          {create && <ArrowUpRightIcon aria-hidden="true" />}
        </TextButton>
      </FieldGroup>
    </FormDialog>
  );
}

export { ProposalOrganizationDialog };
