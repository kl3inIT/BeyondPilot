"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/actions/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { createAdminUseCase, type UseCaseOrganization } from "@/lib/api/generated";
import { fieldOfPointer } from "@/lib/api/problem-fields";
import { siteRoutes } from "@/lib/site";
import { instantInVietnam } from "@/lib/vietnam-time";
import { cn } from "@/lib/utils";

import { adminUseCaseSchema } from "./admin-use-case-schema";
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
import { Choice } from "./wizard-fields";

const blank: DraftValues = {
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
  const [organizationId, setOrganizationId] = useState("");
  const [values, setValues] = useState<DraftValues>(blank);
  const [step, setStep] = useState<Step>("challenge");
  const [problem, setProblem] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const stepIndex = steps.indexOf(step);
  const missing = incompleteSteps(values);
  const organization = organizations.find(({ id }) => id === organizationId);
  const schema = useMemo(
    () =>
      adminUseCaseSchema((key, parameters) =>
        key === "budgetOutOfOrder" ? t("errors.budgetOutOfOrder") : say(key, parameters),
      ),
    [say, t],
  );

  function go(target: Step) {
    setProblem(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function publish() {
    const timeline = timelineOf(values);
    const result = schema.safeParse({
      ...values,
      organizationId,
      timeline,
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      go(stepOfField(String(issue.path[0] ?? "organizationId")));
      setProblem(issue.message);
      return;
    }

    setPublishing(true);
    setProblem(null);
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
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "review") void publish();
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>

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
            <Choice
              label={t("organization")}
              placeholder={t("organizationPlaceholder")}
              hint={t("organizationHint")}
              options={organizations.map(({ id, name }) => ({ value: id, label: name }))}
              value={organizationId}
              onValueChange={setOrganizationId}
            />
          )}

          {step !== "review" && (
            <UseCaseStepFields
              step={step}
              values={values}
              onChange={(patch) => {
                setProblem(null);
                setValues((current) => ({ ...current, ...patch }));
              }}
            />
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
              <Button
                key="publish"
                type="submit"
                pending={publishing}
                disabled={publishing || missing.length > 0 || !organizationId}
              >
                {t("publishSubmit")}
              </Button>
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
