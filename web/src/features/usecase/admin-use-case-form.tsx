"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/actions/button";
import { StepsNav } from "@/components/composites/steps-nav";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { createAdminUseCase, type UseCaseOrganization } from "@/lib/api/generated";
import { fieldOfPointer } from "@/lib/api/problem-fields";
import { siteRoutes } from "@/lib/site";
import { instantInVietnam } from "@/lib/vietnam-time";

import { adminUseCaseSchema, DEFAULT_EDIT_DAYS, editDaysOf } from "./admin-use-case-schema";
import {
  blankDraft,
  incompleteSteps,
  steps,
  timelineOf,
  type DraftValues,
  type Step,
} from "./use-case-draft";
import { UseCaseStepFields } from "./use-case-step-fields";
import { UseCaseSummary } from "./use-case-summary";

/** What the form holds: who the use case is for, the use case in the wizard's own fields, and the days. */
type AdminUseCaseValues = {
  organizationId: string;
  content: DraftValues;
  /** The days a sent proposal may be edited, as typed. */
  proposalEditDays: string;
};

const blank: AdminUseCaseValues = {
  organizationId: "",
  content: blankDraft,
  proposalEditDays: String(DEFAULT_EDIT_DAYS),
};

const refusalSteps = {
  USECASE_ORGANIZATION_NOT_ELIGIBLE: "challenge",
  USECASE_CLOSES_IN_THE_PAST: "budget",
  USECASE_BUDGET_INCOMPLETE: "budget",
  USECASE_BUDGET_OUT_OF_ORDER: "budget",
  USECASE_ATTACHMENT_NOT_USABLE: "requirements",
} as const satisfies Record<string, Step>;

type RefusalCode = keyof typeof refusalSteps;

/** The field each refusal is about, where the form shows it as well. */
const refusalFields = {
  USECASE_ORGANIZATION_NOT_ELIGIBLE: "organizationId",
  USECASE_CLOSES_IN_THE_PAST: "content.closesDay",
  USECASE_BUDGET_INCOMPLETE: "content.budgetMin",
  USECASE_BUDGET_OUT_OF_ORDER: "content.budgetMax",
  USECASE_ATTACHMENT_NOT_USABLE: "content.attachments",
} as const satisfies Record<RefusalCode, string>;

/**
 * The form's field for a field as the schema or the backend names it: the use case's own fields sit
 * under `content`, the timeline is shown on its first number of weeks, the close time on its day.
 */
function formFieldOf(name: string): string {
  if (name === "organizationId" || name === "proposalEditDays") {
    return name;
  }
  if (name.startsWith("timeline")) {
    return "content.timelineMinWeeks";
  }
  if (name === "closesAt") {
    return "content.closesDay";
  }
  if (name === "attachmentFileIds") {
    return "content.attachments";
  }
  return `content.${name}`;
}

function stepOfField(field: string): Step {
  if (["organizationId", "title", "problemStatement", "industry", "technologies"].includes(field)) {
    return "challenge";
  }
  if (["expectedOutcomes", "currentProcess", "currentSolutions", "targetUsers"].includes(field)) {
    return "outcomes";
  }
  if (
    field === "requirements" ||
    field.startsWith("requirements[") ||
    ["dataReadiness", "integrationRequirements", "attachments"].includes(field)
  ) {
    return "requirements";
  }
  return "budget";
}

/**
 * Admin creation uses the organization's five content steps, inside the Admin shell. The operator is
 * the reviewer, so the final action publishes immediately instead of creating another review cycle.
 */
function AdminUseCaseForm({ organizations }: { organizations: UseCaseOrganization[] }) {
  const t = useTranslations("Admin.useCases.form");
  const w = useTranslations("Organization.useCases.wizard");
  const say = useTranslations("Form.errors");
  const notify = useNotify();
  const router = useRouter();
  const [step, setStep] = useState<Step>("challenge");
  // What the step shown must have corrected; it leaves with the step and with the next change.
  const [problem, setProblem] = useState<string | null>(null);
  const schema = useMemo(
    () =>
      adminUseCaseSchema((key, parameters) =>
        key === "budgetOutOfOrder"
          ? t("errors.budgetOutOfOrder")
          : key === "editDays"
            ? t("proposalEditDays.invalid")
            : say(key, parameters),
      ),
    [say, t],
  );

  /** What the schema refuses in what the form holds, the first problem first. */
  const issuesOf = (held: AdminUseCaseValues) =>
    schema.safeParse({
      ...held.content,
      organizationId: held.organizationId,
      timeline: timelineOf(held.content),
      proposalEditDays: held.proposalEditDays,
    }).error?.issues ?? [];

  /** The problems by the form's field, the first of each field. */
  const problemsOf = (held: AdminUseCaseValues) => {
    const fields: Record<string, { message: string }> = {};
    for (const issue of issuesOf(held)) {
      // A path as a field is named: `requirements[2].statement`.
      const name = fieldOfPointer(issue.path.join("/"));
      fields[formFieldOf(name)] ??= { message: issue.message };
    }
    return fields;
  };

  const form = useAppForm({
    defaultValues: blank,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: ({ value }) => {
        const issues = issuesOf(value);
        return issues.length === 0
          ? undefined
          : { form: issues[0].message, fields: problemsOf(value) };
      },
    },
    // What the step shown must have corrected leaves with the next change.
    listeners: { onChange: () => setProblem(null) },
    // The step that holds the first problem opens, with the problem said above its fields.
    onSubmitInvalid: ({ value }) => {
      const issue = issuesOf(value).at(0);
      if (issue) {
        show(Object.keys(problemsOf(value)));
        go(stepOfField(String(issue.path[0] ?? "organizationId")));
        setProblem(issue.message);
      }
    },
    onSubmit: async ({ value }) => {
      setProblem(null);
      await publish(value);
    },
  });
  const organizationId = useStore(form.store, (state) => state.values.organizationId);
  const values = useStore(form.store, (state) => state.values.content);

  const stepIndex = steps.indexOf(step);
  const missing = incompleteSteps(values);
  const organization = organizations.find(({ id }) => id === organizationId);

  /**
   * Lets fields show their problem although the person has not been in them: submitting does that
   * only for the fields of the step on the screen.
   */
  function show(fields: string[]) {
    for (const field of fields as "organizationId"[]) {
      // A field the form has never held has nothing to show.
      if (form.getFieldMeta(field)) {
        form.setFieldMeta(field, (meta) => ({ ...meta, isTouched: true }));
      }
    }
  }

  /** Opens the step a refusal is about, says it above the fields and on the fields it names. */
  function refuse(target: Step, words: string, fields: Record<string, { message: string }>) {
    show(Object.keys(fields));
    go(target);
    setProblem(words);
    setServerErrors(form, { fields });
  }

  function go(target: Step) {
    setProblem(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function publish({
    organizationId,
    content: values,
    proposalEditDays,
  }: AdminUseCaseValues) {
    try {
      const amount = (text: string) => (values.budgetToBeDetermined ? null : Number(text));
      await createAdminUseCase({
        body: {
          organizationId,
          title: values.title.trim(),
          problemStatement: values.problemStatement.trim(),
          industry: values.industry,
          technologies: values.technologies,
          expectedOutcomes: values.expectedOutcomes.trim(),
          currentProcess: values.currentProcess.trim(),
          currentSolutions: values.currentSolutions.trim() || null,
          targetUsers: values.targetUsers.trim(),
          requirements: values.requirements
            .filter(({ statement }) => statement.trim() !== "")
            .map((requirement) => ({ ...requirement, statement: requirement.statement.trim() })),
          dataReadiness: values.dataReadiness.trim(),
          integrationRequirements: values.integrationRequirements.trim(),
          attachmentFileIds: values.attachments.map(({ id }) => id),
          currency: values.currency,
          budgetMin: amount(values.budgetMin),
          budgetMax: amount(values.budgetMax),
          budgetToBeDetermined: values.budgetToBeDetermined,
          budgetMembersOnly: values.budgetMembersOnly,
          timelineMinWeeks: values.timelineMinWeeks!,
          timelineMaxWeeks: values.timelineMaxWeeks!,
          closesAt: instantInVietnam(values.closesDay, values.closesTime),
          hideOrganizationName: values.hideOrganizationName,
          proposalEditDays: editDaysOf(proposalEditDays) ?? DEFAULT_EDIT_DAYS,
          publishNow: true,
        },
      });
      notify.success("Admin.useCases.form.published", { title: values.title.trim() });
      router.push(siteRoutes.adminUseCases);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      if (code && code in refusalSteps) {
        const refusal = code as RefusalCode;
        const words = t(`errors.${refusal}`);
        refuse(refusalSteps[refusal], words, { [refusalFields[refusal]]: { message: words } });
      } else if (error instanceof ApiError && error.violations.length > 0) {
        // The fields the backend points at are marked; it gives no words this screen may show.
        const names = error.violations.map(({ pointer }) => fieldOfPointer(pointer));
        refuse(
          stepOfField(names[0]),
          t("errors.unknown"),
          Object.fromEntries(names.map((name) => [formFieldOf(name), { message: "" }])),
        );
      } else {
        notify.error("Admin.useCases.form.errors.unknown");
      }
    }
  }

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "review") void form.handleSubmit();
      }}
    >
      <AdminPageHeader title={t("title")} lead={t("lead")} />

      {/* A column below 1024px, so the bar of steps has the whole form to stick along. */}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-3 lg:items-start">
        <main className="flex min-w-0 flex-col gap-5 rounded-3xl border bg-background p-6 md:p-10 lg:col-span-2">
          {problem && (
            <Alert variant="destructive">
              <AlertTitle>{t("errors.fix")}</AlertTitle>
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">
              {step === "review" ? t("review.title") : w(`steps.${step}.title`)}
            </h2>
            {step === "review" ? (
              <p className="text-base text-muted-foreground">{t("review.lead")}</p>
            ) : (
              (step === "challenge" || step === "requirements") && (
                <p className="text-base text-muted-foreground">{w(`steps.${step}.lead`)}</p>
              )
            )}
            {step !== "review" && (
              <p className="text-sm text-muted-foreground">{w("allRequired")}</p>
            )}
          </div>

          {step === "challenge" && (
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
          )}

          {step !== "review" && <UseCaseStepFields form={form} fields="content" step={step} />}

          {step === "budget" && (
            <form.AppField name="proposalEditDays">
              {(field) => (
                <field.TextField
                  label={t("proposalEditDays.label")}
                  description={t("proposalEditDays.hint")}
                  inputMode="numeric"
                  maxLength={2}
                />
              )}
            </form.AppField>
          )}

          {step === "review" && <UseCaseSummary values={values} onEdit={go} />}

          <div className="flex items-center justify-between gap-3 border-t pt-6">
            {stepIndex === 0 ? (
              <Button prominence="tertiary" href={siteRoutes.adminUseCases}>
                {t("cancel")}
              </Button>
            ) : (
              <Button prominence="tertiary" type="button" onClick={() => go(steps[stepIndex - 1])}>
                {w("back")}
              </Button>
            )}
            {step === "review" ? (
              <form.AppForm>
                <form.SubmitButton disabled={missing.length > 0 || !organizationId}>
                  {t("publishSubmit")}
                </form.SubmitButton>
              </form.AppForm>
            ) : (
              <Button
                key={`continue-${step}`}
                type="button"
                onClick={() => go(steps[stepIndex + 1])}
              >
                {w("continue")}
              </Button>
            )}
          </div>
        </main>

        {/* From 1024px the steps stay in view beside the form; below that they are the bar above it. */}
        <aside className="flex flex-col gap-6 max-lg:contents lg:sticky lg:top-4">
          <StepsNav
            label={w("stepsLabel")}
            heading={w("yourUseCase")}
            steps={steps.map((name) => ({
              id: name,
              title: name === "review" ? t("review.title") : w(`steps.${name}.title`),
              done: name !== "review" && !missing.includes(name),
            }))}
            current={step}
            onStep={go}
            className="max-lg:order-first max-lg:-mx-4 max-lg:px-4 md:max-lg:-mx-6 md:max-lg:px-6"
          />
          <p className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
            {values.hideOrganizationName
              ? t("publishNoteUnnamed")
              : t("publishNote", {
                  organization: organization?.name ?? t("thisOrganization"),
                })}
          </p>
        </aside>
      </div>
    </form>
  );
}

export { AdminUseCaseForm };
