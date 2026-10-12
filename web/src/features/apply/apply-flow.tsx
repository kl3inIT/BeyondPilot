"use client";

import { useStore } from "@tanstack/react-form";
import {
  CheckIcon,
  Clock3Icon,
  CloudCheckIcon,
  CloudUploadIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { EntryList } from "@/components/composites/entry-list";
import { useAppForm } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { OrganizationFinder } from "@/features/organization/organization-finder";
import { maturities } from "@/features/solution/solution-codes";
import { getPathname, Link } from "@/i18n/navigation";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { ApiError } from "@/lib/api/client";
import {
  createSolution,
  getMySolution,
  organizeApplicant,
  saveApplication,
  saveSolution,
  submitApplication,
  type ApplicationView,
  type FormQuestion,
  type Me,
} from "@/lib/api/generated";
import { chosenOptions } from "@/lib/chosen-options";
import { myApplicationRoute, programRoute, siteRoutes } from "@/lib/site";

import { savable, saveBodyOf, type ApplyDraft } from "./apply-draft";
import {
  AgreementField,
  ChoiceCardsField,
  ChoicesField,
  NativeSelectField,
  Optional,
  PdfField,
} from "./apply-fields";
import { applyFormOptions, checkAgain } from "./apply-form";
import { applyFormatter } from "./apply-format";
import {
  applyStepSchema,
  contactShapeSchema,
  problemsOf,
  type ApplyStep,
  type ApplyWords,
} from "./apply-schemas";
import {
  answersFor,
  appliesAlone,
  organizationBodyOf,
  solutionBodyOf,
  solutionDraftOf,
  valuesOf,
  type ApplyValues,
  type SolutionDraft,
} from "./apply-values";

/** The sizes a team names; one person applies as an individual, a larger company as a company. */
const teamSizes = ["2_9", "10_49", "50_99"] as const;

/** How long the form waits after the last change before it saves. */
const SAVE_AFTER_MS = 1200;

/** A value the form writes itself, such as an identifier a save answered: nobody typed it. */
const quietly = { dontUpdateMeta: true, dontRunListeners: true, dontValidate: true } as const;

/** The form of the flow, a hook of its own so that the steps can name its type. */
function useApplyForm(options: Parameters<typeof applyFormOptions>[0]) {
  return useAppForm(applyFormOptions(options));
}

type ApplyForm = ReturnType<typeof useApplyForm>;

/**
 * Applying to a program in four steps: who applies, the solution, the program's own questions and a
 * review before submitting. One form holds all of it. What is typed is saved as the person goes; a
 * step checks what it needs when the person moves on, and the backend checks everything again on
 * submission.
 */
function ApplyFlow({ initial, account }: { initial: ApplicationView; account: Me }) {
  const t = useTranslations("Apply");
  const say = useTranslations("Form.errors");
  const locale = useLocale();
  const router = useRouter();
  const format = applyFormatter(locale);
  const [view, setView] = useState(initial);
  // Read once: the form starts from the stored draft and is never started again under the person.
  const [defaults] = useState(() => valuesOf(initial, account));
  const [savedAt, setSavedAt] = useState<string | null>(
    initial.application ? initial.application.updatedAt : null,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  // Submitted, and on the way to the receipt: nothing is sent twice meanwhile.
  const [leaving, setLeaving] = useState(false);

  const program = view.program;
  const hasQuestions = program.questions.length > 0;
  const steps: ApplyStep[] = hasQuestions
    ? ["you", "solution", "questions", "review"]
    : ["you", "solution", "review"];
  const [stepNumber, setStepNumber] = useQueryState("step", parseAsInteger.withDefault(1));
  const index = Math.min(Math.max(stepNumber, 1), steps.length) - 1;
  const step = steps[index];

  // Saves run one after another, each with the version the one before answered.
  const version = useRef<number | null>(initial.application?.version ?? null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Whether something waits to be saved. It is not the form's `isDirty`, which compares with what
  // the form started from: a draft saved a moment ago differs from that and has nothing waiting,
  // and a save that failed has something waiting again.
  const changed = useRef(false);
  // The solution of step 2 is a record of its own: whether it waits to be saved, the identifier it
  // was saved under, and the one the application already names.
  const solutionChanged = useRef(false);
  const solutionId = useRef(defaults.solution.id);
  const linked = useRef(defaults.application.solutionId);

  const words: ApplyWords = {
    required: t("you.required"),
    whoRequired: t("you.whoRequired"),
    companyRequired: t("you.companyRequired"),
    phoneRequired: t("you.phoneRequired"),
    countryRequired: t("you.countryRequired"),
    linkedinInvalid: t("you.linkedinInvalid"),
    webAddress: say("webAddress"),
    maturityRequired: t("solution.maturityRequired"),
    deckRequired: t("solution.deckRequired"),
    answerRequired: t("questions.required"),
    answerConfirmRequired: t("questions.confirmRequired"),
    answerChoicesRequired: t("questions.choicesRequired"),
    confirmRequired: t("review.confirmRequired"),
  };

  const form = useApplyForm({
    defaults,
    problems: (values) =>
      problemsOf(
        applyStepSchema(step, words, {
          organization: view.organization,
          who: values.who,
          questions: program.questions,
        }),
        values,
      ),
    // A number or an address the backend would refuse is left out of the saves made while the
    // person types, so its field says so once it is left.
    problemsOnLeaving: (values) =>
      step === "you" ? problemsOf(contactShapeSchema(words), values) : undefined,
    changed: (field) => {
      // Who applies and the team are kept when step 1 is left, and the confirmation never is.
      if (field.startsWith("application.")) {
        changed.current = true;
        setUnsaved(true);
      } else if (field.startsWith("solution.")) {
        solutionChanged.current = true;
        setUnsaved(true);
      }
    },
    submit: (values) => (step === "review" ? submit(values) : next(values)),
  });
  // Each changes only when a field of its own does, so a save waits on its own record alone.
  const draft = useStore(form.store, (state) => state.values.application);
  const solution = useStore(form.store, (state) => state.values.solution);
  const submitting = useStore(form.store, (state) => state.isSubmitting);

  const errorText = useCallback(
    (error: unknown) => {
      const code = error instanceof ApiError ? error.code : undefined;
      const known = [
        "PROPOSAL_CLOSED",
        "PROPOSAL_LOCKED",
        "PROPOSAL_WITHDRAWN_FOR_GOOD",
        "PROPOSAL_CHANGED_MEANWHILE",
        "PROPOSAL_ORGANIZATION_REQUIRED",
        "PROPOSAL_ORGANIZATION_APPLIED",
        "PROPOSAL_CONTACT_INCOMPLETE",
        "PROPOSAL_TEAM_BACKGROUND_REQUIRED",
        "PROPOSAL_SOLUTION_REQUIRED",
        "PROPOSAL_SOLUTION_INCOMPLETE",
        "PROPOSAL_DECK_REQUIRED",
        "PROPOSAL_ANSWER_REQUIRED",
        "PROPOSAL_ANSWER_INVALID",
        "ORGANIZATION_ALREADY_MEMBER",
      ] as const;
      return code && (known as readonly string[]).includes(code)
        ? t(`errors.codes.${code as (typeof known)[number]}`)
        : t("errors.unknown");
    },
    [t],
  );

  /** Why a save made while the person types failed: no answer at all, a refused value, or a rule. */
  const saveProblem = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError) || error.status === undefined) {
        return t("errors.saveFailed");
      }
      return error.violations.length > 0 ? t("errors.saveInvalid") : errorText(error);
    },
    [t, errorText],
  );

  /** Shows what the backend answered; a question it did not ask before gets an empty answer to hold. */
  const show = useCallback(
    (data: ApplicationView) => {
      setView(data);
      const answers = form.state.values.application.answers;
      const held = answersFor(answers, data.program.questions);
      if (held !== answers) {
        form.setFieldValue("application.answers", held, quietly);
      }
    },
    [form],
  );

  const save = useCallback(
    (next: ApplyDraft) => {
      changed.current = false;
      const run = queue.current.then(async () => {
        const { data } = await saveApplication({
          path: { slug: program.slug },
          body: saveBodyOf(next, version.current),
        });
        version.current = data.application?.version ?? null;
        show(data);
        setSavedAt(new Date().toISOString());
        setUnsaved(changed.current || solutionChanged.current);
        return data;
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [program.slug, show],
  );

  /** Saves the solution step 2 edits, making it first when it is new; answers its identifier. */
  const keepSolution = useCallback(
    (next: SolutionDraft) => {
      solutionChanged.current = false;
      const run = queue.current.then(async () => {
        let id = solutionId.current;
        if (!id) {
          const { data } = await createSolution({ body: { name: next.name.trim() } });
          id = data.id;
          solutionId.current = id;
        }
        const { data: found } = await getMySolution({ path: { id } });
        const { data: saved } = await saveSolution({
          path: { id },
          body: solutionBodyOf(next, found),
        });
        if (form.state.values.solution.id !== saved.id) {
          form.setFieldValue("solution.id", saved.id, quietly);
        }
        setSavedAt(new Date().toISOString());
        setUnsaved(changed.current || solutionChanged.current);
        return saved.id;
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [form],
  );

  useEffect(() => {
    if (!changed.current) {
      return;
    }
    const timer = setTimeout(() => {
      // A value the backend would refuse is left out of this save; its field says so when it is left.
      save(savable(draft))
        .then(() => setProblem(null))
        .catch((error: unknown) => {
          changed.current = true;
          setProblem(saveProblem(error));
        });
    }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [draft, save, saveProblem]);

  // The solution saves as it is typed too, from the moment it has the name a solution is made with.
  useEffect(() => {
    if (!solutionChanged.current || solution.name.trim() === "") {
      return;
    }
    const timer = setTimeout(() => {
      keepSolution(solution)
        .then((id) => {
          setProblem(null);
          if (linked.current !== id) {
            linked.current = id;
            changed.current = true;
            form.setFieldValue("application.solutionId", id, quietly);
          }
        })
        .catch((error: unknown) => {
          solutionChanged.current = true;
          setProblem(saveProblem(error));
        });
    }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [solution, keepSolution, saveProblem, form]);

  /** Step 2 turns to another of the organization's solutions, or to a new one. */
  function choose(id: string | null) {
    solutionChanged.current = false;
    solutionId.current = id;
    linked.current = id;
    changed.current = true;
    setUnsaved(true);
    form.setFieldValue("solution", solutionDraftOf(view, id), quietly);
    form.setFieldValue("application.solutionId", id, quietly);
    // What the step refused about the solution before is checked against the one chosen.
    checkAgain(form);
  }

  function goTo(next: number) {
    setProblem(null);
    void setStepNumber(next + 1);
    window.scrollTo({ top: 0 });
  }

  /** Continue, once the step holds what it needs: saves it and opens the next one. */
  async function next(values: ApplyValues) {
    setProblem(null);
    try {
      if (step === "solution") {
        const id = await keepSolution(values.solution);
        linked.current = id;
        form.setFieldValue("application.solutionId", id, quietly);
      }
      // The step is saved before who applies is kept: a refused save then leaves nothing behind.
      await save(form.state.values.application);
      if (step === "you" && !view.organization && values.who !== "") {
        const { data } = await organizeApplicant({
          path: { slug: program.slug },
          body: organizationBodyOf(values),
        });
        show(data);
        version.current = data.application?.version ?? version.current;
      }
      goTo(index + 1);
    } catch (error) {
      setProblem(errorText(error));
    }
  }

  /** Submit, once the information is confirmed: saves the application, then sends it. */
  async function submit(values: ApplyValues) {
    setProblem(null);
    try {
      const saved = await save(values.application);
      const id = saved.application?.id;
      if (!id) {
        throw new Error("The application was not saved");
      }
      await submitApplication({ path: { id } });
      setLeaving(true);
      router.push(getPathname({ href: `${myApplicationRoute(id)}/submitted`, locale }));
    } catch (error) {
      setProblem(errorText(error));
    }
  }

  async function saveAndExit() {
    const values = form.state.values;
    let current = savable(values.application);
    // A save that fails keeps the person on the page, where what they typed still is.
    try {
      if (solutionChanged.current && values.solution.name.trim() !== "") {
        const id = await keepSolution(values.solution);
        if (id !== linked.current) {
          linked.current = id;
          changed.current = true;
          current = { ...current, solutionId: id };
        }
      }
      if (changed.current) {
        await save(current);
      }
    } catch (error) {
      solutionChanged.current = solutionChanged.current || values.solution.id === null;
      changed.current = true;
      setProblem(saveProblem(error));
      return;
    }
    router.push(getPathname({ href: siteRoutes.myApplications, locale }));
  }

  const closes = format.deadline(program.closesAt);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            BeyondPilot
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
            {program.name}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {(unsaved || savedAt) && (
              <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                role="status"
              >
                {unsaved ? (
                  <CloudUploadIcon className="size-4" aria-hidden="true" />
                ) : (
                  <CloudCheckIcon className="size-4 text-success" aria-hidden="true" />
                )}
                {unsaved || !savedAt ? t("unsaved") : t("saved", { time: format.time(savedAt) })}
              </span>
            )}
            <span className="hidden items-center gap-1.5 rounded-full border bg-muted px-3 py-1.5 text-xs font-medium md:flex">
              <Clock3Icon className="size-3.5" aria-hidden="true" />
              {t("closes", { when: closes })}
            </span>
            <Button prominence="tertiary" onClick={() => void saveAndExit()}>
              <XIcon aria-hidden="true" className="md:hidden" />
              <span className="max-md:sr-only">{t("saveAndExit")}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 pb-32 md:flex-row md:items-start md:gap-12 md:px-8 md:pt-12">
        <aside className="hidden w-64 shrink-0 flex-col gap-6 md:flex">
          <p className="text-xs text-muted-foreground">{t("yourApplication")}</p>
          <ol className="flex flex-col">
            {steps.map((key, position) => {
              const done = position < index;
              const current = position === index;
              return (
                <li key={key} className="relative flex gap-3 pb-6 last:pb-0">
                  {position < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={
                        done
                          ? "absolute top-7 bottom-0 left-3 w-0.5 bg-primary"
                          : "absolute top-7 bottom-0 left-3 w-0.5 bg-border"
                      }
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={
                      done
                        ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : current
                          ? "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-semibold text-primary"
                          : "flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs text-muted-foreground"
                    }
                  >
                    {done ? <CheckIcon className="size-3.5" /> : position + 1}
                  </span>
                  <div className="flex flex-col" aria-current={current ? "step" : undefined}>
                    <span
                      className={current ? "text-sm font-medium" : "text-sm text-muted-foreground"}
                    >
                      {t(`steps.${key}.title`)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="flex gap-2 rounded-xl border bg-background p-3 text-xs text-muted-foreground">
            <CloudCheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
            {t("savesAsYouType", { when: closes })}
          </p>
        </aside>

        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              {t("stepOf", {
                step: index + 1,
                count: steps.length,
                title: t(`steps.${step}.title`),
              })}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock3Icon className="size-3.5" aria-hidden="true" />
              {closes}
            </span>
          </div>
          <Progress value={((index + 1) / steps.length) * 100} aria-label={t("progress")} />
        </div>

        <main className="flex min-w-0 flex-1 flex-col gap-8 rounded-3xl border bg-card p-5 md:p-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-title md:text-3xl">
              {t(`steps.${step}.title`)}
            </h1>
            <p className="text-muted-foreground">
              {t(`steps.${step}.lead`, { program: program.name, when: closes })}
            </p>
            {step !== "review" && (
              <p className="text-sm text-muted-foreground">{t("allRequired")}</p>
            )}
          </div>

          {!program.open && (
            <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">
              {t("closed", { when: closes })}
            </p>
          )}

          <form
            id={form.formId}
            noValidate
            className="flex flex-col gap-8"
            onSubmit={(event) => {
              event.preventDefault();
              // A form in a dialog opened from here sends its own event up, and Enter in the search
              // box of the company finder searches: neither is Continue.
              const active = document.activeElement;
              if (
                event.target !== event.currentTarget ||
                (active instanceof HTMLInputElement && active.type === "search") ||
                !program.open ||
                leaving
              ) {
                return;
              }
              // What another step, or a choice the form made itself, left in error is checked against
              // what the form holds now: a field that is not on the screen must not hold this step back.
              checkAgain(form);
              void form.handleSubmit();
            }}
          >
            {step === "you" && <StepYou form={form} view={view} />}
            {step === "solution" && <StepSolution form={form} view={view} choose={choose} />}
            {step === "questions" && (
              <StepQuestions
                form={form}
                questions={program.questions}
                files={view.application?.files ?? {}}
              />
            )}
            {step === "review" && <StepReview form={form} view={view} steps={steps} edit={goTo} />}

            <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-3 border-t bg-background px-4 pt-3 pb-6 md:static md:border-t md:bg-transparent md:px-0 md:pt-6 md:pb-0">
              {/* With the actions, so on a phone it is not under the bar they are fixed in. */}
              {problem && (
                <p role="alert" className="text-sm text-destructive">
                  {problem}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                {index === 0 ? (
                  <Button prominence="tertiary" href={programRoute(program.slug)}>
                    {t("backToProgram")}
                  </Button>
                ) : (
                  <Button
                    prominence="tertiary"
                    disabled={submitting || leaving}
                    onClick={() => goTo(index - 1)}
                  >
                    {t("back")}
                  </Button>
                )}
                <form.AppForm>
                  <form.SubmitButton disabled={!program.open || leaving}>
                    {step !== "review"
                      ? t("continue")
                      : view.application?.status === "submitted"
                        ? t("submitAgain")
                        : t("submit")}
                  </form.SubmitButton>
                </form.AppForm>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function StepYou({ form, view }: { form: ApplyForm; view: ApplicationView }) {
  const t = useTranslations("Apply.you");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const countryName = useCountryName();
  const organization = view.organization;
  const who = useStore(form.store, (state) => state.values.who);
  const name = useStore(form.store, (state) => {
    const contact = state.values.application.contact;
    return contact.firstName.trim() ? `${contact.firstName.trim()} ${contact.lastName.trim()}` : "";
  });

  return (
    <>
      {organization ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("applyingFor")}</h2>
          <div className="flex flex-col gap-1 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{organization.name}</span>
              {!organization.approved && <Badge variant="outline">{t("notListedYet")}</Badge>}
            </div>
            <span className="text-sm text-muted-foreground">
              {[
                typeName(organization.type),
                organization.teamSize && sizeName(organization.teamSize),
                organization.country && countryName(organization.country),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          {!organization.approved && (
            <p className="text-xs text-muted-foreground">{t("applyingForHint")}</p>
          )}
        </section>
      ) : (
        <form.AppField name="who">
          {() => (
            <ChoiceCardsField
              label={t("applyingAs")}
              description={t("applyingAsHint")}
              note={
                who === "individual" && name ? t("individualHint", { name: name.trim() }) : null
              }
              options={(["individual", "team", "company"] as const).map((kind) => ({
                value: kind,
                label: t(`who.${kind}.title`),
                what: t(`who.${kind}.what`),
              }))}
              detail={
                who === "company" && (
                  <>
                    <h2 className="text-lg font-medium">{t("yourCompany")}</h2>
                    <OrganizationFinder suggestion={null} embedded />
                  </>
                )
              }
            />
          )}
        </form.AppField>
      )}

      <section className="flex flex-col gap-5 border-t pt-8">
        <h2 className="text-lg font-medium">{t("aboutYou")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <form.AppField name="application.contact.firstName">
            {(field) => (
              <field.TextField label={t("firstName")} autoComplete="given-name" maxLength={80} />
            )}
          </form.AppField>
          <form.AppField name="application.contact.lastName">
            {(field) => (
              <field.TextField label={t("lastName")} autoComplete="family-name" maxLength={80} />
            )}
          </form.AppField>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" value={view.email} readOnly disabled aria-describedby="email-hint" />
          <FieldDescription id="email-hint">{t("emailHint")}</FieldDescription>
        </Field>
        <form.AppField name="application.contact.phone">
          {(field) => (
            <field.TextField
              label={t("phone")}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              description={t("phoneHint")}
            />
          )}
        </form.AppField>
        <div className="grid gap-5 sm:grid-cols-2">
          <form.AppField name="application.contact.country">
            {() => (
              <NativeSelectField
                label={t("country")}
                placeholder={t("countryPlaceholder")}
                options={countryCodes.map((code) => ({ value: code, label: countryName(code) }))}
              />
            )}
          </form.AppField>
          <form.AppField name="application.contact.linkedin">
            {(field) => (
              <field.TextField
                label={t("linkedin")}
                type="url"
                inputMode="url"
                maxLength={300}
                description={t("addressHint")}
              />
            )}
          </form.AppField>
        </div>
      </section>

      {!organization && who === "team" && (
        <section className="flex flex-col gap-5 border-t pt-8">
          <h2 className="text-lg font-medium">{t("yourTeam")}</h2>
          <form.AppField name="team.name">
            {(field) => (
              <field.TextField
                label={t("teamName")}
                maxLength={120}
                description={t("teamNameHint")}
              />
            )}
          </form.AppField>
          <div className="grid gap-5 sm:grid-cols-2">
            <form.AppField name="team.size">
              {() => (
                <NativeSelectField
                  label={t("teamSize")}
                  options={teamSizes.map((size) => ({ value: size, label: sizeName(size) }))}
                />
              )}
            </form.AppField>
            <form.AppField name="team.website">
              {(field) => (
                <field.TextField
                  label={t("website")}
                  optional
                  type="url"
                  inputMode="url"
                  maxLength={300}
                  description={t("addressHint")}
                />
              )}
            </form.AppField>
          </div>
        </section>
      )}

      {!appliesAlone(organization, who) && (
        <form.AppField name="application.teamBackground">
          {(field) => (
            <field.TextareaField
              label={t("teamBackground")}
              maxLength={2000}
              description={t("teamBackgroundHint")}
            />
          )}
        </form.AppField>
      )}
    </>
  );
}

function StepSolution({
  form,
  view,
  choose,
}: {
  form: ApplyForm;
  view: ApplicationView;
  choose: (id: string | null) => void;
}) {
  const t = useTranslations("Apply.solution");
  const maturity = useVocabulary("maturity");
  const solution = useStore(form.store, (state) => state.values.solution);
  // The rest of the step can only be kept once the solution has the name it is made with.
  const unnamed =
    solution.name.trim() === "" &&
    [solution.summary, solution.problemsSolved, solution.maturity, solution.demoUrl].some(
      (value) => value.trim() !== "",
    );

  return (
    <>
      {view.solutions.length > 0 && (
        // Not a field of the form: choosing fills the fields below from the solution chosen.
        <Field>
          <FieldLabel htmlFor="solutionChoice">{t("choice")}</FieldLabel>
          <NativeSelect
            id="solutionChoice"
            className="w-full"
            value={solution.id ?? ""}
            onChange={(event) => choose(event.target.value || null)}
            aria-describedby="solutionChoice-hint"
          >
            {view.solutions.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.name}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="">{t("newSolution")}</NativeSelectOption>
          </NativeSelect>
          <FieldDescription id="solutionChoice-hint">{t("choiceHint")}</FieldDescription>
        </Field>
      )}
      <form.AppField name="solution.name">
        {(field) => (
          <field.TextField
            label={t("name")}
            maxLength={120}
            description={unnamed ? t("nameToSave") : undefined}
          />
        )}
      </form.AppField>
      <form.AppField name="solution.summary">
        {(field) => (
          <field.TextareaField
            label={t("summary")}
            maxLength={300}
            description={t("summaryHint")}
          />
        )}
      </form.AppField>
      <form.AppField name="solution.problemsSolved">
        {(field) => (
          <field.TextareaField
            label={t("problemsSolved")}
            maxLength={4000}
            description={t("problemsSolvedHint")}
          />
        )}
      </form.AppField>
      <form.AppField name="solution.maturity">
        {() => (
          <NativeSelectField
            label={t("maturity")}
            placeholder={t("maturityPlaceholder")}
            options={maturities.map((code) => ({ value: code, label: maturity(code) }))}
          />
        )}
      </form.AppField>
      <form.AppField name="application.traction">
        {(field) => (
          <field.TextareaField
            label={t("traction")}
            optional
            maxLength={600}
            description={t("tractionHint")}
          />
        )}
      </form.AppField>
      <form.Field name="application.builtWith">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="builtWith">
              {t("builtWith")}
              <Optional />
            </FieldLabel>
            <EntryList
              id="builtWith"
              label={t("builtWith")}
              value={field.state.value}
              onChange={field.handleChange}
              describedBy="builtWith-hint"
              max={10}
              maxLength={60}
            />
            <FieldDescription id="builtWith-hint">{t("builtWithHint")}</FieldDescription>
          </Field>
        )}
      </form.Field>
      <form.AppField name="application.deck">
        {(field) => (
          <PdfField
            id="deck"
            label={t("deck")}
            description={t("deckHint")}
            value={field.state.value}
            onChange={(file) => field.handleChange(file && { ...file })}
          />
        )}
      </form.AppField>
      <form.AppField name="solution.demoUrl">
        {(field) => (
          <field.TextField
            label={t("demoUrl")}
            optional
            type="url"
            inputMode="url"
            maxLength={300}
            description={t("demoUrlHint")}
          />
        )}
      </form.AppField>
    </>
  );
}

function StepQuestions({
  form,
  questions,
  files,
}: {
  form: ApplyForm;
  questions: FormQuestion[];
  files: Record<string, { fileId: string; fileName: string; sizeBytes: number }>;
}) {
  const t = useTranslations("Apply.questions");
  return (
    <>
      {questions.map((question) => {
        const id = `question-${question.id}`;
        const help = question.help ?? undefined;
        return (
          <form.AppField key={question.id} name={`application.answers.${question.id}`}>
            {(field) =>
              question.kind === "confirm" ? (
                <AgreementField id={id} label={question.label} description={help} />
              ) : question.kind === "multi_choice" ? (
                <ChoicesField
                  id={id}
                  label={question.label}
                  optional={!question.required}
                  description={help}
                  options={question.options}
                />
              ) : question.kind === "single_choice" ? (
                <NativeSelectField
                  label={question.label}
                  optional={!question.required}
                  description={help}
                  placeholder={t("choose")}
                  options={question.options.map((option) => ({ value: option, label: option }))}
                />
              ) : question.kind === "file" ? (
                <PdfField
                  id={id}
                  label={question.label}
                  optional={!question.required}
                  description={help}
                  value={
                    field.state.value
                      ? (files[question.id] ?? {
                          fileId: field.state.value,
                          fileName: t("uploaded"),
                          sizeBytes: 0,
                        })
                      : null
                  }
                  onChange={(file) => field.handleChange(file?.fileId ?? "")}
                />
              ) : question.kind === "long_text" ? (
                <field.TextareaField
                  label={question.label}
                  optional={!question.required}
                  description={help}
                  maxLength={question.maxLength}
                />
              ) : (
                <field.TextField
                  label={question.label}
                  optional={!question.required}
                  description={help}
                  type={question.kind === "link" ? "url" : "text"}
                  inputMode={question.kind === "link" ? "url" : undefined}
                  placeholder={question.kind === "link" ? "https://" : undefined}
                  maxLength={question.maxLength}
                />
              )
            }
          </form.AppField>
        );
      })}
    </>
  );
}

function StepReview({
  form,
  view,
  steps,
  edit,
}: {
  form: ApplyForm;
  view: ApplicationView;
  steps: ApplyStep[];
  edit: (index: number) => void;
}) {
  const t = useTranslations("Apply.review");
  const you = useTranslations("Apply.you");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const maturity = useVocabulary("maturity");
  const countryName = useCountryName();
  const draft = useStore(form.store, (state) => state.values.application);
  const solution = useStore(form.store, (state) => state.values.solution);
  const contact = draft.contact;
  const organization = view.organization;
  const none = t("notAdded");

  const blocks: { step: Exclude<ApplyStep, "review">; rows: [string, string][] }[] = [
    {
      step: "you",
      rows: [
        [
          t("applyingAs"),
          organization ? `${organization.name} · ${typeName(organization.type)}` : none,
        ],
        [t("name"), `${contact.firstName} ${contact.lastName}`.trim() || none],
        [you("email"), view.email],
        [you("phone"), contact.phone || none],
        [you("country"), contact.country ? countryName(contact.country) : none],
        [you("linkedin"), contact.linkedin || none],
        ...(organization?.teamSize && organization.type !== "independent_builder"
          ? [[t("teamSize"), sizeName(organization.teamSize)] as [string, string]]
          : []),
        ...(draft.teamBackground
          ? [[you("teamBackground"), draft.teamBackground] as [string, string]]
          : []),
      ],
    },
    {
      step: "solution",
      rows: [
        [t("solution"), solution.name || none],
        [t("summary"), solution.summary || none],
        [t("problemsSolved"), solution.problemsSolved || none],
        [t("maturity"), solution.maturity ? maturity(solution.maturity) : none],
        [t("traction"), draft.traction || none],
        [t("builtWith"), draft.builtWith.join(", ") || none],
        [t("deck"), draft.deck?.fileName ?? none],
      ],
    },
    ...(steps.includes("questions")
      ? [
          {
            step: "questions" as const,
            rows: view.program.questions.map((question): [string, string] => {
              const value = draft.answers[question.id] ?? "";
              const shown =
                question.kind === "confirm"
                  ? value === "true"
                    ? t("confirmed")
                    : none
                  : question.kind === "file"
                    ? (view.application?.files[question.id]?.fileName ??
                      (value ? t("uploaded") : none))
                    : question.kind === "multi_choice"
                      ? // One choice a line: a choice may hold a comma of its own.
                        chosenOptions(value).join("\n") || none
                      : value || none;
              return [question.label, shown];
            }),
          },
        ]
      : []),
  ];

  return (
    <>
      {blocks.map((block) => (
        <section key={block.step} className="flex flex-col gap-3 rounded-xl border p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">{t(`blocks.${block.step}`)}</h2>
            <Button
              prominence="tertiary"
              size="sm"
              aria-label={t("editNamed", { section: t(`blocks.${block.step}`) })}
              onClick={() => edit(steps.indexOf(block.step))}
            >
              <PencilIcon aria-hidden="true" />
              {t("edit")}
            </Button>
          </div>
          <dl className="flex flex-col gap-2.5">
            {block.rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 text-sm sm:grid-cols-3 sm:gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words whitespace-pre-line sm:col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <form.AppField name="confirmed">
        {(field) => <field.CheckboxField label={t("confirm")} />}
      </form.AppField>
    </>
  );
}

export { ApplyFlow };
