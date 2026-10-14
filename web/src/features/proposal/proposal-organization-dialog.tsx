"use client";

import { useQuery } from "@tanstack/react-query";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { ArrowUpRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { TextButton } from "@/components/actions/text-button";
import { FormDialog } from "@/components/composites/form-dialog";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { AllRequired, ChoiceCardsField } from "@/components/form/form-fields";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { teamSizeAfterTypeChange, teamSizesFor } from "@/features/organization/organization-codes";
import { MAX_DESCRIPTION } from "@/features/organization/organization-format";
import { OrganizationIndustriesField } from "@/features/organization/organization-industries-field";
import {
  basicsBodyOf,
  basicsSchema,
  basicsValuesOf,
  createsAlone,
  givesCompanyFacts,
  profileRefusals,
} from "@/features/organization/organization-schemas";
import { useNotify } from "@/hooks/use-notify";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  createOrganizationFromBasics,
  getMyOrganization,
  saveMyOrganizationBasics,
  type Organization,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
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
 * Creates or edits the selected type's required facts over the proposal. Optional profile facts
 * remain on the organization's own page and are never cleared by this popup.
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

const creators = ["independent_builder", "builder_team", "company"] as const;

function BasicsForm({ organization, create, open, onOpenChange, onSaved }: BasicsFormProps) {
  const t = useTranslations("UseCaseProposal.wizard.organization.dialog");
  const f = useTranslations("Organization.form");
  const notify = useNotify();
  const router = useRouter();
  const sizeName = useVocabulary("teamSize");
  const countryName = useCountryName();

  const form = useAppForm({
    defaultValues: {
      ...basicsValuesOf(organization),
      name: organization?.name ?? create?.name ?? "",
      country: organization?.country ?? create?.country ?? "",
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: basicsSchema(f) },
    onSubmit: async ({ value, formApi }) => {
      const body = basicsBodyOf(value, organization?.version);
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
            {
              message:
                field in profileRefusals
                  ? f(profileRefusals[field as keyof typeof profileRefusals])
                  : t("required"),
            },
          ]),
        );
        setServerErrors(formApi, { fields });
        notify.failure(error);
      }
    },
  });

  const type = useStore(form.store, (state) => state.values.type);
  const alone = createsAlone(type);
  const company = givesCompanyFacts(type);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      title={create ? t("createTitle") : t("title")}
      width="xl"
      submitLabel={create ? t("create") : t("save")}
      cancelLabel={t("cancel")}
    >
      <AllRequired>
        <FieldGroup>
          <form.AppField
            name="type"
            listeners={{
              onChange: ({ value, fieldApi }) => {
                // Just me is one person; a team or a company says how many it is.
                fieldApi.form.setFieldValue(
                  "teamSize",
                  teamSizeAfterTypeChange(value, fieldApi.form.getFieldValue("teamSize")),
                );
              },
            }}
          >
            {() => (
              <ChoiceCardsField
                label={f("creator.label")}
                className="grid-cols-3"
                options={creators.map((value) => ({
                  value,
                  label: f(`creator.${value}`),
                }))}
              />
            )}
          </form.AppField>
          <div className={`grid gap-x-3 gap-y-4 ${company ? "sm:grid-cols-2" : ""}`}>
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  label={f(alone ? "ownName" : "name")}
                  maxLength={120}
                  requiredMark
                />
              )}
            </form.AppField>
            {company && (
              <form.AppField name="website">
                {(field) => (
                  <field.TextField
                    label={f("website")}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    maxLength={300}
                    description={f("websiteFormatHint")}
                    requiredMark
                  />
                )}
              </form.AppField>
            )}
          </div>
          <div className={`grid gap-x-3 gap-y-4 ${alone ? "" : "sm:grid-cols-2"}`}>
            {!alone && (
              <form.AppField name="teamSize">
                {(field) => (
                  <field.SelectField
                    label={f("teamSize")}
                    placeholder={f("teamSizePlaceholder")}
                    requiredMark
                    options={teamSizesFor(type).map((value) => ({
                      value,
                      label: sizeName(value),
                    }))}
                  />
                )}
              </form.AppField>
            )}
            <form.AppField name="country">
              {(field) => (
                <field.SelectField
                  label={f("country")}
                  placeholder={f("countryPlaceholder")}
                  requiredMark
                  options={countryCodes.map((code) => ({ value: code, label: countryName(code) }))}
                />
              )}
            </form.AppField>
          </div>
          {company && (
            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
              <form.AppField name="industries">
                {() => <OrganizationIndustriesField required />}
              </form.AppField>
              <form.AppField name="foundedYear">
                {(field) => (
                  <field.TextField
                    label={f("foundedYear")}
                    inputMode="numeric"
                    maxLength={4}
                    description={f("foundedYearFormatHint")}
                    requiredMark
                  />
                )}
              </form.AppField>
            </div>
          )}
          {!alone && (
            <form.AppField name="description">
              {(field) => (
                <field.TextareaField
                  label={f("description")}
                  description={f("descriptionHint")}
                  rows={4}
                  maxLength={MAX_DESCRIPTION}
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
      </AllRequired>
    </FormDialog>
  );
}

export { ProposalOrganizationDialog };
