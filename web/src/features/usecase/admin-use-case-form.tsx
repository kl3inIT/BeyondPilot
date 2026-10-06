"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import { ApiError } from "@/lib/api/client";
import { createAdminUseCase, type UseCaseOrganization } from "@/lib/api/generated";
import { fieldOfPointer } from "@/lib/api/problem-fields";
import { siteRoutes } from "@/lib/site";
import { instantInVietnam } from "@/lib/vietnam-time";

import {
  necessities,
  publishChoices,
  timelineCodes,
  timelinePresets,
  useCaseIndustries,
  useCaseTechnologies,
} from "./admin-use-case-codes";
import { AttachmentsField } from "./admin-use-case-attachments";
import { adminUseCaseSchema, MAX_TEXT, type AdminUseCaseValues } from "./admin-use-case-schema";

const blank: AdminUseCaseValues = {
  organizationId: "",
  title: "",
  problemStatement: "",
  industry: "" as AdminUseCaseValues["industry"],
  technologies: [],
  expectedOutcomes: "",
  currentProcess: "",
  currentSolutions: "",
  targetUsers: "",
  requirements: [
    { statement: "", necessity: "required" },
    { statement: "", necessity: "required" },
    { statement: "", necessity: "optional" },
  ],
  dataReadiness: "",
  integrationRequirements: "",
  attachments: [],
  budgetMin: "",
  budgetMax: "",
  budgetToBeDetermined: false,
  budgetMembersOnly: false,
  timeline: "" as AdminUseCaseValues["timeline"],
  hideOrganizationName: false,
  publish: "draft",
  closesDay: "",
  closesTime: "23:59",
};

/** What a refusal by the backend says about the form, by the field it concerns. */
const refusals = {
  USECASE_ORGANIZATION_NOT_ELIGIBLE: "organizationId",
  USECASE_CLOSES_IN_THE_PAST: "closesDay",
  USECASE_BUDGET_INCOMPLETE: "budgetMin",
  USECASE_BUDGET_OUT_OF_ORDER: "budgetMax",
  USECASE_ATTACHMENT_NOT_USABLE: "attachments",
} as const;

function refusalOf(code: string | undefined) {
  return Object.entries(refusals).find(([known]) => known === code);
}

/** The cards that start closed, and the fields each holds, so a refused save can open the right one. */
const sections = {
  outcomes: ["expectedOutcomes", "currentProcess", "currentSolutions", "targetUsers"],
  requirements: ["requirements", "dataReadiness", "integrationRequirements", "attachments"],
  budget: ["budgetMin", "budgetMax", "timeline", "hideOrganizationName"],
} as const;

type SectionName = keyof typeof sections;

function sectionOf(field: string): SectionName | undefined {
  return (Object.keys(sections) as SectionName[]).find((name) =>
    sections[name].some((member) => field === member || field.startsWith(`${member}[`)),
  );
}

type OpenSectionProps = {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A card that shows its title and what it holds, and opens to the fields themselves. */
function OpenSection({ title, description, open, onToggle, children }: OpenSectionProps) {
  const t = useTranslations("Admin.useCases.form");
  const bodyId = useId();

  return (
    <Card size="lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <TextButton aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
            {open ? t("close") : t("open")}
          </TextButton>
        </CardAction>
      </CardHeader>
      {/* Kept in the page while closed, so what was typed is sent and its errors can open it. */}
      <CardContent id={bodyId} hidden={!open}>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  );
}

/**
 * Admin › Create a use case: an operator writes a use case on behalf of an approved enterprise.
 * The right-hand panel decides what saving does: keep a draft the organization edits and sends for
 * review, or publish at once, the operator being the reviewer.
 */
function AdminUseCaseForm({ organizations }: { organizations: UseCaseOrganization[] }) {
  const t = useTranslations("Admin.useCases.form");
  const say = useTranslations("Form.errors");
  const industryName = useVocabulary("industry");
  const technologyName = useVocabulary("technology");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState<Record<SectionName, boolean>>({
    outcomes: false,
    requirements: false,
    budget: false,
  });

  const form = useAppForm({
    defaultValues: blank,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: adminUseCaseSchema((key, values) =>
        key === "budgetOutOfOrder" ? t("errors.budgetOutOfOrder") : say(key, values),
      ),
    },
    onSubmitInvalid: ({ formApi }) => {
      // A closed card that holds a wrong field opens, so the error can be seen.
      const wrong = Object.entries(formApi.state.fieldMeta)
        .filter(([, meta]) => (meta?.errors.length ?? 0) > 0)
        .map(([name]) => sectionOf(name))
        .filter((name) => name !== undefined);
      if (wrong.length > 0) {
        setOpen((current) => {
          const next = { ...current };
          for (const name of wrong) {
            next[name] = true;
          }
          return next;
        });
      }
    },
    onSubmit: async ({ value, formApi }) => {
      const number = (text: string) => (text === "" ? null : Number(text));
      const weeks = timelinePresets[value.timeline as keyof typeof timelinePresets];
      const publishNow = value.publish === "publish";
      try {
        await createAdminUseCase({
          body: {
            organizationId: value.organizationId,
            title: value.title.trim(),
            problemStatement: value.problemStatement,
            industry: value.industry,
            technologies: value.technologies,
            expectedOutcomes: value.expectedOutcomes,
            currentProcess: value.currentProcess,
            currentSolutions: value.currentSolutions.trim() || null,
            targetUsers: value.targetUsers,
            requirements: value.requirements,
            dataReadiness: value.dataReadiness,
            integrationRequirements: value.integrationRequirements,
            attachmentFileIds: value.attachments.map((file) => file.id),
            budgetMin: value.budgetToBeDetermined ? null : number(value.budgetMin),
            budgetMax: value.budgetToBeDetermined ? null : number(value.budgetMax),
            budgetToBeDetermined: value.budgetToBeDetermined,
            budgetMembersOnly: value.budgetMembersOnly,
            timelineMinWeeks: weeks.min,
            timelineMaxWeeks: weeks.max,
            closesAt: instantInVietnam(value.closesDay, value.closesTime),
            hideOrganizationName: value.hideOrganizationName,
            publishNow,
          },
        });
        notify.success(publishNow ? "Admin.useCases.form.published" : "Admin.useCases.form.saved", {
          title: value.title.trim(),
        });
        router.push(siteRoutes.adminUseCases);
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        const refusal = refusalOf(code);
        if (refusal) {
          const [known, field] = refusal;
          setServerErrors(formApi, {
            fields: { [field]: { message: t(`errors.${known as keyof typeof refusals}`) } },
          });
          const section = sectionOf(field);
          if (section) {
            setOpen((current) => ({ ...current, [section]: true }));
          }
        } else if (error instanceof ApiError && error.violations.length > 0) {
          setServerErrors(formApi, {
            fields: Object.fromEntries(
              error.violations.map((violation) => [
                fieldOfPointer(violation.pointer),
                { message: say("invalid") },
              ]),
            ),
          });
        } else {
          notify.error("Admin.useCases.form.errors.unknown");
        }
      }
    },
  });

  const toggle = (name: SectionName) => () =>
    setOpen((current) => ({ ...current, [name]: !current[name] }));

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card size="lg">
            <CardHeader>
              <CardTitle>{t("sections.organization")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form.AppField name="organizationId">
                {(field) => (
                  <field.SelectField
                    label={t("organization")}
                    placeholder={t("organizationPlaceholder")}
                    description={t("organizationHint")}
                    options={organizations.map(({ id, name }) => ({ value: id, label: name }))}
                  />
                )}
              </form.AppField>
            </CardContent>
          </Card>

          <Card size="lg">
            <CardHeader>
              <CardTitle>{t("sections.challenge")}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <form.AppField name="title">
                  {(field) => (
                    <field.TextField
                      label={t("useCaseTitle")}
                      description={t("useCaseTitleHint")}
                      maxLength={200}
                    />
                  )}
                </form.AppField>
                <form.AppField name="problemStatement">
                  {(field) => (
                    <field.TextareaField
                      label={t("problemStatement")}
                      description={t("problemStatementHint")}
                      maxLength={MAX_TEXT}
                      rows={4}
                      showCount
                    />
                  )}
                </form.AppField>
                <form.AppField name="industry">
                  {(field) => (
                    <field.SelectField
                      label={t("industry")}
                      placeholder={t("choose")}
                      options={useCaseIndustries.map((value) => ({
                        value,
                        label: industryName(value),
                      }))}
                    />
                  )}
                </form.AppField>
                <form.Field name="technologies">
                  {(field) => {
                    const invalid =
                      field.state.meta.isTouched && field.state.meta.errors.length > 0;
                    return (
                      <Field data-invalid={invalid || undefined}>
                        <FieldLabel>{t("technologies")}</FieldLabel>
                        <div className="grid gap-x-6 gap-y-3 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5">
                          {useCaseTechnologies.map((value) => (
                            <label key={value} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={field.state.value.includes(value)}
                                onCheckedChange={(checked) =>
                                  field.handleChange(
                                    checked === true
                                      ? [...field.state.value, value]
                                      : field.state.value.filter((chosen) => chosen !== value),
                                  )
                                }
                              />
                              {technologyName(value)}
                            </label>
                          ))}
                        </div>
                        {invalid && <FieldError>{say("required")}</FieldError>}
                      </Field>
                    );
                  }}
                </form.Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <OpenSection
            title={t("sections.outcomes.title")}
            description={t("sections.outcomes.description")}
            open={open.outcomes}
            onToggle={toggle("outcomes")}
          >
            <form.AppField name="expectedOutcomes">
              {(field) => (
                <field.TextareaField
                  label={t("expectedOutcomes")}
                  description={t("expectedOutcomesHint")}
                  maxLength={MAX_TEXT}
                  rows={4}
                  showCount
                />
              )}
            </form.AppField>
            <form.AppField name="currentProcess">
              {(field) => (
                <field.TextareaField
                  label={t("currentProcess")}
                  description={t("currentProcessHint")}
                  maxLength={MAX_TEXT}
                  rows={4}
                  showCount
                />
              )}
            </form.AppField>
            <form.AppField name="currentSolutions">
              {(field) => (
                <field.TextareaField
                  label={t("currentSolutions")}
                  description={t("currentSolutionsHint")}
                  maxLength={MAX_TEXT}
                  rows={4}
                  showCount
                />
              )}
            </form.AppField>
            <form.AppField name="targetUsers">
              {(field) => (
                <field.TextareaField
                  label={t("targetUsers")}
                  description={t("targetUsersHint")}
                  maxLength={MAX_TEXT}
                  rows={4}
                  showCount
                />
              )}
            </form.AppField>
          </OpenSection>

          <OpenSection
            title={t("sections.requirements.title")}
            description={t("sections.requirements.description")}
            open={open.requirements}
            onToggle={toggle("requirements")}
          >
            <form.Field name="requirements" mode="array">
              {(requirements) => (
                <div className="flex flex-col gap-4">
                  {requirements.state.value.map((_, index) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-4">
                      <div className="sm:col-span-3">
                        <form.AppField name={`requirements[${index}].statement`}>
                          {(field) => (
                            <field.TextField
                              label={t("requirement", { number: index + 1 })}
                              maxLength={300}
                            />
                          )}
                        </form.AppField>
                      </div>
                      <form.AppField name={`requirements[${index}].necessity`}>
                        {(field) => (
                          <field.SelectField
                            label={t("necessity.label")}
                            options={necessities.map((value) => ({
                              value,
                              label: t(`necessity.${value}`),
                            }))}
                          />
                        )}
                      </form.AppField>
                    </div>
                  ))}
                  <TextButton
                    className="self-start"
                    onClick={() => requirements.pushValue({ statement: "", necessity: "required" })}
                  >
                    <PlusIcon aria-hidden="true" />
                    {t("addRequirement")}
                  </TextButton>
                </div>
              )}
            </form.Field>
            <form.AppField name="dataReadiness">
              {(field) => (
                <field.TextareaField
                  label={t("dataReadiness")}
                  description={t("dataReadinessHint")}
                  maxLength={MAX_TEXT}
                  rows={4}
                  showCount
                />
              )}
            </form.AppField>
            <form.AppField name="integrationRequirements">
              {(field) => (
                <field.TextareaField
                  label={t("integrationRequirements")}
                  description={t("integrationRequirementsHint")}
                  maxLength={MAX_TEXT}
                  rows={4}
                  showCount
                />
              )}
            </form.AppField>
            <form.Field name="attachments">
              {(field) => (
                <AttachmentsField
                  id="attachments"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
          </OpenSection>

          <OpenSection
            title={t("sections.budget.title")}
            description={t("sections.budget.description")}
            open={open.budget}
            onToggle={toggle("budget")}
          >
            <form.Subscribe selector={(state) => state.values.budgetToBeDetermined}>
              {(undecided) => (
                <div className="grid gap-4 sm:grid-cols-2">
                  <form.AppField name="budgetMin">
                    {(field) => (
                      <field.TextField
                        label={t("budgetMin")}
                        inputMode="numeric"
                        disabled={undecided}
                        maxLength={9}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="budgetMax">
                    {(field) => (
                      <field.TextField
                        label={t("budgetMax")}
                        inputMode="numeric"
                        disabled={undecided}
                        maxLength={9}
                      />
                    )}
                  </form.AppField>
                </div>
              )}
            </form.Subscribe>
            <form.AppField name="budgetToBeDetermined">
              {(field) => <field.CheckboxField label={t("budgetToBeDetermined")} />}
            </form.AppField>
            <form.AppField name="budgetMembersOnly">
              {(field) => <field.CheckboxField label={t("budgetMembersOnly")} />}
            </form.AppField>
            <form.AppField name="timeline">
              {(field) => (
                <field.SelectField
                  label={t("timeline.label")}
                  placeholder={t("choose")}
                  options={timelineCodes.map((value) => ({
                    value,
                    label: t(`timeline.${value}`),
                  }))}
                />
              )}
            </form.AppField>
            <form.AppField name="hideOrganizationName">
              {(field) => <field.CheckboxField label={t("hideOrganizationName")} />}
            </form.AppField>
          </OpenSection>
        </div>

        <Card size="lg" className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>{t("publish.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <form.Field name="publish">
                {(field) => (
                  <Field>
                    <FieldLabel id="publish-label">{t("publish.when")}</FieldLabel>
                    <RadioGroup
                      aria-labelledby="publish-label"
                      value={field.state.value}
                      onValueChange={(value) =>
                        field.handleChange(value as typeof field.state.value)
                      }
                    >
                      {publishChoices.map((choice) => (
                        <label
                          key={choice}
                          className="relative flex cursor-pointer flex-col gap-1 rounded-lg border p-4 pr-10 text-sm has-data-checked:border-primary has-data-checked:bg-primary/10"
                        >
                          <RadioGroupItem value={choice} className="absolute top-4 right-4" />
                          <span className="font-medium">{t(`publish.${choice}.title`)}</span>
                          <form.Subscribe selector={(state) => state.values.organizationId}>
                            {(id) => (
                              <span className="text-muted-foreground">
                                {t(`publish.${choice}.description`, {
                                  organization:
                                    organizations.find((organization) => organization.id === id)
                                      ?.name ?? t("publish.thisOrganization"),
                                })}
                              </span>
                            )}
                          </form.Subscribe>
                        </label>
                      ))}
                    </RadioGroup>
                  </Field>
                )}
              </form.Field>

              <Field>
                <FieldLabel htmlFor="closesDay">{t("closes")}</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <form.Field name="closesDay">
                    {(field) => (
                      <Input
                        id="closesDay"
                        type="date"
                        value={field.state.value}
                        aria-invalid={field.state.meta.errors.length > 0 || undefined}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    )}
                  </form.Field>
                  <form.Field name="closesTime">
                    {(field) => (
                      <Input
                        type="time"
                        aria-label={t("closesTime")}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    )}
                  </form.Field>
                </div>
                <form.Subscribe selector={(state) => state.fieldMeta.closesDay?.errors ?? []}>
                  {(errors) =>
                    errors.length > 0 ? (
                      <FieldError errors={errors} />
                    ) : (
                      <FieldDescription>{t("closesHint")}</FieldDescription>
                    )
                  }
                </form.Subscribe>
              </Field>

              <form.AppForm>
                <div className="flex flex-col gap-3">
                  <form.Subscribe selector={(state) => state.values.publish}>
                    {(publish) => (
                      <form.SubmitButton className="w-full">
                        {t(publish === "publish" ? "publishSubmit" : "draftSubmit")}
                      </form.SubmitButton>
                    )}
                  </form.Subscribe>
                  <Button prominence="secondary" className="w-full" href={siteRoutes.adminUseCases}>
                    {t("cancel")}
                  </Button>
                </div>
              </form.AppForm>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

export { AdminUseCaseForm };
