"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/actions/button";
import { useAppForm } from "@/components/form/app-form";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { createAdminUseCase, type UseCaseOrganization } from "@/lib/api/generated";
import { fieldOfPointer } from "@/lib/api/problem-fields";
import { siteRoutes } from "@/lib/site";
import { instantInVietnam } from "@/lib/vietnam-time";
import { cn } from "@/lib/utils";

import { adminUseCaseSchema, DEFAULT_EDIT_DAYS, editDaysOf } from "./admin-use-case-schema";
import {
  defaultClosesTime,
  incompleteSteps,
  steps,
  timelineOf,
  type DraftValues,
  type Step,
} from "./use-case-draft";
import { UseCaseStepFields } from "./use-case-step-fields";
import { UseCaseSummary } from "./use-case-summary";

/**
 * What the form holds. The use case itself is one value: its fields are the wizard's, which the
 * organization's own wizard and the review screen draw too, and they take and give the whole draft.
 */
type AdminUseCaseValues = {
  organizationId: string;
  content: DraftValues;
  /** The days a sent proposal may be edited, as typed. */
  proposalEditDays: string;
};

const blankContent: DraftValues = {
  title: "",
  problemStatement: "",
  industry: "",
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
  currency: "USD",
  budgetMin: "",
  budgetMax: "",
  budgetToBeDetermined: false,
  budgetMembersOnly: false,
  timelineMinWeeks: null,
  timelineMaxWeeks: null,
  closesDay: "",
  closesTime: defaultClosesTime,
  hideOrganizationName: false,
};

const blank: AdminUseCaseValues = {
  organizationId: "",
  content: blankContent,
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

  const form = useAppForm({
    defaultValues: blank,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: ({ value }) => {
        const issues = issuesOf(value);
        if (issues.length === 0) {
          return undefined;
        }
        // The two fields of this form say their own problem; the wizard's fields have no place for one.
        const on = (name: string) => issues.find((issue) => issue.path[0] === name);
        return {
          form: issues[0].message,
          fields: {
            organizationId: on("organizationId"),
            proposalEditDays: on("proposalEditDays"),
          },
        };
      },
    },
    // The step that holds the first problem opens, with the problem said above its fields.
    onSubmitInvalid: ({ value }) => {
      const issue = issuesOf(value).at(0);
      if (issue) {
        go(stepOfField(String(issue.path[0] ?? "organizationId")));
        setProblem(issue.message);
      }
    },
    onSubmit: async ({ value }) => {
      setProblem(null);
      await publish(value);
    },
  });
  const { organizationId, content: values } = useStore(form.store, (state) => state.values);

  const stepIndex = steps.indexOf(step);
  const missing = incompleteSteps(values);
  const organization = organizations.find(({ id }) => id === organizationId);

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
        go(refusalSteps[refusal]);
        setProblem(t(`errors.${refusal}`));
      } else if (error instanceof ApiError && error.violations.length > 0) {
        go(stepOfField(fieldOfPointer(error.violations[0].pointer)));
        setProblem(t("errors.unknown"));
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

      <div className="grid items-start gap-8 xl:grid-cols-3">
        <main className="flex min-w-0 flex-col gap-5 rounded-3xl border bg-background p-6 md:p-10 xl:col-span-2">
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

          {step !== "review" && (
            <form.Field name="content">
              {(field) => (
                <UseCaseStepFields
                  step={step}
                  values={field.state.value}
                  onChange={(patch) => {
                    setProblem(null);
                    field.handleChange((current) => ({ ...current, ...patch }));
                  }}
                />
              )}
            </form.Field>
          )}

          {step === "budget" && (
            <form.AppField name="proposalEditDays" listeners={{ onChange: () => setProblem(null) }}>
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

        <aside className="flex flex-col gap-6 xl:sticky xl:top-4">
          <nav aria-label={w("stepsLabel")}>
            <p className="mb-3 text-xs font-medium text-muted-foreground">{w("yourUseCase")}</p>
            <ol className="flex flex-col">
              {steps.map((name, index) => {
                const done = name !== "review" && !missing.includes(name);
                const current = name === step;
                return (
                  <li key={name} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                          current
                            ? "border-primary bg-background text-primary"
                            : done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground",
                        )}
                      >
                        {done ? <CheckIcon className="size-3.5" /> : index + 1}
                      </span>
                      {index < steps.length - 1 && (
                        <span
                          className={cn("my-1 w-0.5 flex-1", done ? "bg-primary" : "bg-border")}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      aria-current={current ? "step" : undefined}
                      onClick={() => go(name)}
                      className={cn(
                        "-mx-2 -mt-1 mb-4 flex flex-col items-start rounded-md px-2 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        current && "bg-primary/10",
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium",
                          current ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {name === "review" ? t("review.title") : w(`steps.${name}.title`)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
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
