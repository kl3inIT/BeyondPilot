"use client";

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
import { PdfUpload } from "@/components/composites/pdf-upload";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
import { focusField } from "@/lib/focus-field";
import { myApplicationRoute, programRoute, siteRoutes } from "@/lib/site";

import { draftOf, invalidContact, savable, saveBodyOf, type ApplyDraft } from "./apply-draft";
import { applyFormatter } from "./apply-format";

/** The sizes a team names; one person applies as an individual, a larger company as a company. */
const teamSizes = ["2_9", "10_49", "50_99"] as const;

/** How long the form waits after the last change before it saves. */
const SAVE_AFTER_MS = 1200;

type Who = "individual" | "team" | "company";
type StepKey = "you" | "solution" | "questions" | "review";

/** A solution as step 2 edits it; a new one has no identifier until it is saved. */
type SolutionDraft = {
  id: string | null;
  name: string;
  summary: string;
  problemsSolved: string;
  maturity: string;
  demoUrl: string;
};

function solutionDraftOf(view: ApplicationView, id: string | null): SolutionDraft {
  const found = view.solutions.find((solution) => solution.id === id);
  return {
    id: found?.id ?? null,
    name: found?.name ?? "",
    summary: found?.summary ?? "",
    problemsSolved: found?.problemsSolved ?? "",
    maturity: found?.maturity ?? "",
    demoUrl: "",
  };
}

/**
 * Applying to a program in four steps: who applies, the solution, the program's own questions and a
 * review before submitting. What is typed is saved as the person goes; a step checks what it needs
 * only when the person moves on, and the backend checks everything again on submission.
 */
function ApplyFlow({ initial, account }: { initial: ApplicationView; account: Me }) {
  const t = useTranslations("Apply");
  const locale = useLocale();
  const router = useRouter();
  const format = applyFormatter(locale);
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState<ApplyDraft>(() => draftOf(initial, account));
  const [solution, setSolution] = useState<SolutionDraft>(() =>
    solutionDraftOf(initial, draftOf(initial, account).solutionId),
  );
  // Nobody is chosen for the person: who applies is kept with the account once step 1 is left.
  const [who, setWho] = useState<Who | null>(null);
  const [team, setTeam] = useState({ name: "", size: "2_9" as string, website: "" });
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [savedAt, setSavedAt] = useState<string | null>(
    initial.application ? initial.application.updatedAt : null,
  );
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);

  const program = view.program;
  const hasQuestions = program.questions.length > 0;
  const steps: StepKey[] = hasQuestions
    ? ["you", "solution", "questions", "review"]
    : ["you", "solution", "review"];
  const [stepNumber, setStepNumber] = useQueryState("step", parseAsInteger.withDefault(1));
  const index = Math.min(Math.max(stepNumber, 1), steps.length) - 1;
  const step = steps[index];

  // Saves run one after another, each with the version the one before answered.
  const version = useRef<number | null>(initial.application?.version ?? null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const changed = useRef(false);
  // The solution of step 2 is a record of its own: whether it waits to be saved, the identifier it
  // was saved under, and the one the application already names.
  const solutionChanged = useRef(false);
  const solutionId = useRef(solution.id);
  const linked = useRef(draft.solutionId);

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

  const save = useCallback(
    (next: ApplyDraft) => {
      changed.current = false;
      const run = queue.current.then(async () => {
        const { data } = await saveApplication({
          path: { slug: program.slug },
          body: saveBodyOf(next, version.current),
        });
        version.current = data.application?.version ?? null;
        setView(data);
        setSavedAt(new Date().toISOString());
        setUnsaved(changed.current || solutionChanged.current);
        return data;
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [program.slug, setUnsaved],
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
          body: {
            name: next.name.trim(),
            summary: next.summary.trim() || null,
            problemsSolved: next.problemsSolved.trim() || null,
            valueProposition: found.valueProposition ?? null,
            focusAreas: found.focusAreas,
            industries: found.industries,
            maturity: (next.maturity || undefined) as (typeof maturities)[number] | undefined,
            deployment: found.deployment,
            website: found.website ?? null,
            demoUrl: next.demoUrl.trim() || found.demoUrl || null,
            traction: found.traction ?? null,
            builtWith: found.builtWith,
            languages: found.languages,
            bestCustomerProfile: found.bestCustomerProfile ?? null,
            deckFileId: found.deck?.fileId ?? null,
            logoFileId: found.logo?.fileId ?? null,
            coverFileId: found.cover?.fileId ?? null,
            imageFileIds: found.images.map((image) => image.fileId),
            listed: found.listed,
            version: found.version,
          },
        });
        setSolution((current) =>
          current.id === saved.id ? current : { ...current, id: saved.id },
        );
        setSavedAt(new Date().toISOString());
        setUnsaved(changed.current || solutionChanged.current);
        return saved.id;
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [setSolution, setUnsaved],
  );

  useEffect(() => {
    if (!changed.current) {
      return;
    }
    const timer = setTimeout(() => {
      // A value the backend would refuse is said beside its field and left out of this save.
      const invalid = invalidContact(draft);
      if (invalid.length > 0) {
        setMissing((current) => new Set([...current, ...invalid]));
      }
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
            setDraft((current) => ({ ...current, solutionId: id }));
          }
        })
        .catch((error: unknown) => {
          solutionChanged.current = true;
          setProblem(saveProblem(error));
        });
    }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [solution, keepSolution, saveProblem]);

  function change(update: (current: ApplyDraft) => ApplyDraft) {
    changed.current = true;
    setUnsaved(true);
    setDraft((current) => update(current));
  }

  const settle = (field: string) =>
    setMissing((current) => {
      if (!current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.delete(field);
      return next;
    });

  function writeContact(field: keyof ApplyDraft["contact"], value: string) {
    change((current) => ({ ...current, contact: { ...current.contact, [field]: value } }));
    settle(field);
  }

  function goTo(next: number) {
    setProblem(null);
    setMissing(new Set());
    void setStepNumber(next + 1);
    window.scrollTo({ top: 0 });
  }

  /** What a step lacks before the person may leave it forward, by field, in the order of the form. */
  function lacking(key: StepKey): string[] {
    const blank = (value: string) => value.trim() === "";
    if (key === "you") {
      const contact = draft.contact;
      const invalid = invalidContact(draft);
      const fields = [
        !view.organization && who === null ? "who" : null,
        !view.organization && who === "team" && blank(team.name) ? "teamName" : null,
        !view.organization && who === "company" ? "company" : null,
        blank(contact.firstName) ? "firstName" : null,
        blank(contact.lastName) ? "lastName" : null,
        blank(contact.phone) || invalid.includes("phone") ? "phone" : null,
        blank(contact.country) ? "country" : null,
        invalid.includes("linkedin") ? "linkedin" : null,
        alone() ? null : blank(draft.teamBackground) ? "teamBackground" : null,
      ];
      return fields.filter((field): field is string => field !== null);
    }
    if (key === "solution") {
      return [
        blank(solution.name) ? "solutionName" : null,
        blank(solution.summary) ? "summary" : null,
        blank(solution.problemsSolved) ? "problemsSolved" : null,
        blank(solution.maturity) ? "maturity" : null,
        draft.deck ? null : "deck",
      ].filter((field): field is string => field !== null);
    }
    if (key === "questions") {
      return program.questions
        .filter((question) => question.required && !(draft.answers[question.id] ?? "").trim())
        .map((question) => `question-${question.id}`);
    }
    return [];
  }

  /** One person applying on their own is not asked about a team. */
  function alone() {
    return view.organization
      ? view.organization.type === "independent_builder"
      : who !== "team" && who !== "company";
  }

  async function next() {
    const lack = lacking(step);
    if (lack.length > 0) {
      setMissing(new Set(lack));
      focusField(lack[0]);
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      let current = draft;
      if (step === "solution") {
        const id = await keepSolution(solution);
        linked.current = id;
        current = { ...draft, solutionId: id };
        setDraft(current);
      }
      // The step is saved before who applies is kept: a refused save then leaves nothing behind.
      await save(current);
      if (step === "you" && !view.organization && who !== null) {
        const contact = draft.contact;
        const { data } = await organizeApplicant({
          path: { slug: program.slug },
          body:
            who === "individual"
              ? {
                  kind: "individual",
                  name: `${contact.firstName.trim()} ${contact.lastName.trim()}`,
                  country: contact.country,
                }
              : {
                  kind: "team",
                  name: team.name.trim(),
                  country: contact.country,
                  teamSize: team.size as "2_9",
                  website: team.website.trim() || null,
                },
        });
        setView(data);
        version.current = data.application?.version ?? version.current;
      }
      goTo(index + 1);
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    if (!confirmed) {
      setMissing(new Set(["confirm"]));
      focusField("confirm");
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      const saved = await save(draft);
      const id = saved.application?.id;
      if (!id) {
        throw new Error("The application was not saved");
      }
      await submitApplication({ path: { id } });
      router.push(getPathname({ href: `${myApplicationRoute(id)}/submitted`, locale }));
    } catch (error) {
      setProblem(errorText(error));
      setPending(false);
    }
  }

  async function saveAndExit() {
    let current = savable(draft);
    // A save that fails keeps the person on the page, where what they typed still is.
    try {
      if (solutionChanged.current && solution.name.trim() !== "") {
        const id = await keepSolution(solution);
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
      solutionChanged.current = solutionChanged.current || solution.id === null;
      changed.current = true;
      setProblem(saveProblem(error));
      return;
    }
    router.push(getPathname({ href: siteRoutes.myApplications, locale }));
  }

  const closes = format.deadline(program.closesAt);
  const bad = (field: string) => missing.has(field) || undefined;

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

          {step === "you" && (
            <StepYou
              view={view}
              draft={draft}
              who={who}
              setWho={(value) => {
                setWho(value);
                settle("who");
              }}
              team={team}
              setTeam={setTeam}
              writeContact={writeContact}
              setBackground={(value) => {
                change((current) => ({ ...current, teamBackground: value }));
                settle("teamBackground");
              }}
              alone={alone()}
              bad={bad}
            />
          )}
          {step === "solution" && (
            <StepSolution
              view={view}
              draft={draft}
              solution={solution}
              choose={(id) => {
                solutionChanged.current = false;
                solutionId.current = id;
                linked.current = id;
                setSolution(solutionDraftOf(view, id));
                change((current) => ({ ...current, solutionId: id }));
              }}
              edit={(field, value) => {
                solutionChanged.current = true;
                setUnsaved(true);
                setSolution((current) => ({ ...current, [field]: value }));
                settle(field === "name" ? "solutionName" : field);
              }}
              change={change}
              settle={settle}
              bad={bad}
            />
          )}
          {step === "questions" && (
            <StepQuestions
              questions={program.questions}
              answers={draft.answers}
              files={view.application?.files ?? {}}
              answer={(id, value) => {
                change((current) => ({ ...current, answers: { ...current.answers, [id]: value } }));
                settle(`question-${id}`);
              }}
              bad={bad}
            />
          )}
          {step === "review" && (
            <StepReview
              view={view}
              draft={draft}
              solution={solution}
              steps={steps}
              edit={goTo}
              confirmed={confirmed}
              confirm={(value) => {
                setConfirmed(value);
                settle("confirm");
              }}
              bad={bad}
            />
          )}

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
                <Button prominence="tertiary" disabled={pending} onClick={() => goTo(index - 1)}>
                  {t("back")}
                </Button>
              )}
              {step === "review" ? (
                <Button pending={pending} disabled={!program.open} onClick={() => void submit()}>
                  {view.application?.status === "submitted" ? t("submitAgain") : t("submit")}
                </Button>
              ) : (
                <Button pending={pending} disabled={!program.open} onClick={() => void next()}>
                  {t("continue")}
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

type Bad = (field: string) => true | undefined;

function Optional() {
  const t = useTranslations("Apply");
  return <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>;
}

function Required({ show, children }: { show: true | undefined; children: React.ReactNode }) {
  return show ? <FieldError>{children}</FieldError> : null;
}

function StepYou({
  view,
  draft,
  who,
  setWho,
  team,
  setTeam,
  writeContact,
  setBackground,
  alone,
  bad,
}: {
  view: ApplicationView;
  draft: ApplyDraft;
  who: Who | null;
  setWho: (who: Who) => void;
  team: { name: string; size: string; website: string };
  setTeam: (team: { name: string; size: string; website: string }) => void;
  writeContact: (field: keyof ApplyDraft["contact"], value: string) => void;
  setBackground: (value: string) => void;
  alone: boolean;
  bad: Bad;
}) {
  const t = useTranslations("Apply.you");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const countryName = useCountryName();
  const organization = view.organization;
  const contact = draft.contact;

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
        <Field data-invalid={bad("who")}>
          <FieldLabel>{t("applyingAs")}</FieldLabel>
          <RadioGroup
            id="who"
            value={who ?? ""}
            onValueChange={(value) => setWho(value as Who)}
            aria-label={t("applyingAs")}
            aria-invalid={bad("who")}
          >
            {(["individual", "team", "company"] as const).map((kind) => (
              <FieldLabel key={kind} htmlFor={`who-${kind}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{t(`who.${kind}.title`)}</FieldTitle>
                    <FieldDescription>{t(`who.${kind}.what`)}</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value={kind} id={`who-${kind}`} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
          <FieldDescription>{t("applyingAsHint")}</FieldDescription>
          <Required show={bad("who")}>{t("whoRequired")}</Required>
          {who === "individual" && contact.firstName.trim() && (
            <FieldDescription>
              {t("individualHint", {
                name: `${contact.firstName.trim()} ${contact.lastName.trim()}`.trim(),
              })}
            </FieldDescription>
          )}
        </Field>
      )}

      {!organization && who === "company" && (
        <section className="flex flex-col gap-3" id="company" tabIndex={-1}>
          <h2 className="text-lg font-medium">{t("yourCompany")}</h2>
          <OrganizationFinder suggestion={null} embedded />
          {bad("company") && <FieldError>{t("companyRequired")}</FieldError>}
        </section>
      )}

      <section className="flex flex-col gap-5 border-t pt-8">
        <h2 className="text-lg font-medium">{t("aboutYou")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={bad("firstName")}>
            <FieldLabel htmlFor="firstName">{t("firstName")}</FieldLabel>
            <Input
              id="firstName"
              autoComplete="given-name"
              maxLength={80}
              value={contact.firstName}
              onChange={(event) => writeContact("firstName", event.target.value)}
              aria-invalid={bad("firstName")}
            />
            <Required show={bad("firstName")}>{t("required")}</Required>
          </Field>
          <Field data-invalid={bad("lastName")}>
            <FieldLabel htmlFor="lastName">{t("lastName")}</FieldLabel>
            <Input
              id="lastName"
              autoComplete="family-name"
              maxLength={80}
              value={contact.lastName}
              onChange={(event) => writeContact("lastName", event.target.value)}
              aria-invalid={bad("lastName")}
            />
            <Required show={bad("lastName")}>{t("required")}</Required>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" value={view.email} readOnly disabled aria-describedby="email-hint" />
          <FieldDescription id="email-hint">{t("emailHint")}</FieldDescription>
        </Field>
        <Field data-invalid={bad("phone")}>
          <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
            value={contact.phone}
            onChange={(event) => writeContact("phone", event.target.value)}
            aria-invalid={bad("phone")}
            aria-describedby="phone-hint"
          />
          <FieldDescription id="phone-hint">{t("phoneHint")}</FieldDescription>
          <Required show={bad("phone")}>{t("phoneRequired")}</Required>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={bad("country")}>
            <FieldLabel htmlFor="country">{t("country")}</FieldLabel>
            <NativeSelect
              id="country"
              className="w-full"
              value={contact.country}
              onChange={(event) => writeContact("country", event.target.value)}
              aria-invalid={bad("country")}
            >
              <NativeSelectOption value="">{t("countryPlaceholder")}</NativeSelectOption>
              {countryCodes.map((code) => (
                <NativeSelectOption key={code} value={code}>
                  {countryName(code)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Required show={bad("country")}>{t("countryRequired")}</Required>
          </Field>
          <Field data-invalid={bad("linkedin")}>
            <FieldLabel htmlFor="linkedin">{t("linkedin")}</FieldLabel>
            <Input
              id="linkedin"
              type="url"
              inputMode="url"
              maxLength={300}
              value={contact.linkedin}
              onChange={(event) => writeContact("linkedin", event.target.value)}
              aria-invalid={bad("linkedin")}
              aria-describedby="linkedin-hint"
            />
            <FieldDescription id="linkedin-hint">{t("addressHint")}</FieldDescription>
            <Required show={bad("linkedin")}>{t("linkedinInvalid")}</Required>
          </Field>
        </div>
      </section>

      {!organization && who === "team" && (
        <section className="flex flex-col gap-5 border-t pt-8">
          <h2 className="text-lg font-medium">{t("yourTeam")}</h2>
          <Field data-invalid={bad("teamName")}>
            <FieldLabel htmlFor="teamName">{t("teamName")}</FieldLabel>
            <Input
              id="teamName"
              maxLength={120}
              value={team.name}
              onChange={(event) => setTeam({ ...team, name: event.target.value })}
              aria-invalid={bad("teamName")}
              aria-describedby="teamName-hint"
            />
            <FieldDescription id="teamName-hint">{t("teamNameHint")}</FieldDescription>
            <Required show={bad("teamName")}>{t("required")}</Required>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="teamSize">{t("teamSize")}</FieldLabel>
              <NativeSelect
                id="teamSize"
                className="w-full"
                value={team.size}
                onChange={(event) => setTeam({ ...team, size: event.target.value })}
              >
                {teamSizes.map((size) => (
                  <NativeSelectOption key={size} value={size}>
                    {sizeName(size)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="website">
                {t("website")}
                <Optional />
              </FieldLabel>
              <Input
                id="website"
                type="url"
                inputMode="url"
                maxLength={300}
                value={team.website}
                onChange={(event) => setTeam({ ...team, website: event.target.value })}
                aria-describedby="website-hint"
              />
              <FieldDescription id="website-hint">{t("addressHint")}</FieldDescription>
            </Field>
          </div>
        </section>
      )}

      {!alone && (
        <Field data-invalid={bad("teamBackground")}>
          <FieldLabel htmlFor="teamBackground">{t("teamBackground")}</FieldLabel>
          <Textarea
            id="teamBackground"
            maxLength={2000}
            value={draft.teamBackground}
            onChange={(event) => setBackground(event.target.value)}
            aria-invalid={bad("teamBackground")}
            aria-describedby="teamBackground-hint"
          />
          <FieldDescription id="teamBackground-hint">{t("teamBackgroundHint")}</FieldDescription>
          <Required show={bad("teamBackground")}>{t("required")}</Required>
        </Field>
      )}
    </>
  );
}

function StepSolution({
  view,
  draft,
  solution,
  choose,
  edit,
  change,
  settle,
  bad,
}: {
  view: ApplicationView;
  draft: ApplyDraft;
  solution: SolutionDraft;
  choose: (id: string | null) => void;
  edit: (field: keyof SolutionDraft, value: string) => void;
  change: (update: (current: ApplyDraft) => ApplyDraft) => void;
  settle: (field: string) => void;
  bad: Bad;
}) {
  const t = useTranslations("Apply.solution");
  const maturity = useVocabulary("maturity");
  // The rest of the step can only be kept once the solution has the name it is made with.
  const unnamed =
    solution.name.trim() === "" &&
    [solution.summary, solution.problemsSolved, solution.maturity, solution.demoUrl].some(
      (value) => value.trim() !== "",
    );

  return (
    <>
      {view.solutions.length > 0 && (
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
      <Field data-invalid={bad("solutionName")}>
        <FieldLabel htmlFor="solutionName">{t("name")}</FieldLabel>
        <Input
          id="solutionName"
          maxLength={120}
          value={solution.name}
          onChange={(event) => edit("name", event.target.value)}
          aria-invalid={bad("solutionName")}
          aria-describedby={unnamed ? "solutionName-hint" : undefined}
        />
        {unnamed && <FieldDescription id="solutionName-hint">{t("nameToSave")}</FieldDescription>}
        <Required show={bad("solutionName")}>{t("required")}</Required>
      </Field>
      <Field data-invalid={bad("summary")}>
        <FieldLabel htmlFor="summary">{t("summary")}</FieldLabel>
        <Textarea
          id="summary"
          maxLength={300}
          value={solution.summary}
          onChange={(event) => edit("summary", event.target.value)}
          aria-invalid={bad("summary")}
          aria-describedby="summary-hint"
        />
        <FieldDescription id="summary-hint">{t("summaryHint")}</FieldDescription>
        <Required show={bad("summary")}>{t("required")}</Required>
      </Field>
      <Field data-invalid={bad("problemsSolved")}>
        <FieldLabel htmlFor="problemsSolved">{t("problemsSolved")}</FieldLabel>
        <Textarea
          id="problemsSolved"
          maxLength={4000}
          value={solution.problemsSolved}
          onChange={(event) => edit("problemsSolved", event.target.value)}
          aria-invalid={bad("problemsSolved")}
          aria-describedby="problemsSolved-hint"
        />
        <FieldDescription id="problemsSolved-hint">{t("problemsSolvedHint")}</FieldDescription>
        <Required show={bad("problemsSolved")}>{t("required")}</Required>
      </Field>
      <Field data-invalid={bad("maturity")}>
        <FieldLabel htmlFor="maturity">{t("maturity")}</FieldLabel>
        <NativeSelect
          id="maturity"
          className="w-full"
          value={solution.maturity}
          onChange={(event) => edit("maturity", event.target.value)}
          aria-invalid={bad("maturity")}
        >
          <NativeSelectOption value="">{t("maturityPlaceholder")}</NativeSelectOption>
          {maturities.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {maturity(code)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Required show={bad("maturity")}>{t("maturityRequired")}</Required>
      </Field>
      <Field>
        <FieldLabel htmlFor="traction">
          {t("traction")}
          <Optional />
        </FieldLabel>
        <Textarea
          id="traction"
          maxLength={600}
          value={draft.traction}
          onChange={(event) => change((current) => ({ ...current, traction: event.target.value }))}
          aria-describedby="traction-hint"
        />
        <FieldDescription id="traction-hint">{t("tractionHint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="builtWith">
          {t("builtWith")}
          <Optional />
        </FieldLabel>
        <EntryList
          id="builtWith"
          label={t("builtWith")}
          value={draft.builtWith}
          onChange={(value) => change((current) => ({ ...current, builtWith: value }))}
          describedBy="builtWith-hint"
          max={10}
          maxLength={60}
        />
        <FieldDescription id="builtWith-hint">{t("builtWithHint")}</FieldDescription>
      </Field>
      <Field data-invalid={bad("deck")}>
        <FieldLabel htmlFor="deck">{t("deck")}</FieldLabel>
        <PdfUpload
          id="deck"
          value={draft.deck}
          invalid={!!bad("deck")}
          describedBy="deck-hint"
          onChange={(file) => {
            change((current) => ({ ...current, deck: file && { ...file } }));
            settle("deck");
          }}
        />
        <FieldDescription id="deck-hint">{t("deckHint")}</FieldDescription>
        <Required show={bad("deck")}>{t("deckRequired")}</Required>
      </Field>
      <Field>
        <FieldLabel htmlFor="demoUrl">
          {t("demoUrl")}
          <Optional />
        </FieldLabel>
        <Input
          id="demoUrl"
          type="url"
          inputMode="url"
          maxLength={300}
          value={solution.demoUrl}
          onChange={(event) => edit("demoUrl", event.target.value)}
          aria-describedby="demoUrl-hint"
        />
        <FieldDescription id="demoUrl-hint">{t("demoUrlHint")}</FieldDescription>
      </Field>
    </>
  );
}

function StepQuestions({
  questions,
  answers,
  files,
  answer,
  bad,
}: {
  questions: FormQuestion[];
  answers: Record<string, string>;
  files: Record<string, { fileId: string; fileName: string; sizeBytes: number }>;
  answer: (id: string, value: string) => void;
  bad: Bad;
}) {
  const t = useTranslations("Apply.questions");
  return (
    <>
      {questions.map((question) => {
        const id = `question-${question.id}`;
        const value = answers[question.id] ?? "";
        const label = (
          <>
            {question.label}
            {!question.required && <Optional />}
          </>
        );
        const help = question.help && (
          <FieldDescription id={`${id}-hint`}>{question.help}</FieldDescription>
        );
        if (question.kind === "confirm") {
          return (
            <Field key={question.id} orientation="horizontal" data-invalid={bad(id)}>
              <Checkbox
                id={id}
                checked={value === "true"}
                onCheckedChange={(checked) => answer(question.id, checked ? "true" : "")}
                aria-invalid={bad(id)}
              />
              <FieldContent>
                <FieldLabel htmlFor={id}>{question.label}</FieldLabel>
                {help}
                <Required show={bad(id)}>{t("confirmRequired")}</Required>
              </FieldContent>
            </Field>
          );
        }
        return (
          <Field key={question.id} data-invalid={bad(id)}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {question.kind === "single_choice" ? (
              <NativeSelect
                id={id}
                className="w-full"
                value={value}
                onChange={(event) => answer(question.id, event.target.value)}
                aria-invalid={bad(id)}
              >
                <NativeSelectOption value="">{t("choose")}</NativeSelectOption>
                {question.options.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : question.kind === "file" ? (
              <PdfUpload
                id={id}
                value={
                  value
                    ? (files[question.id] ?? {
                        fileId: value,
                        fileName: t("uploaded"),
                        sizeBytes: 0,
                      })
                    : null
                }
                invalid={!!bad(id)}
                onChange={(file) => answer(question.id, file?.fileId ?? "")}
              />
            ) : question.kind === "long_text" ? (
              <Textarea
                id={id}
                maxLength={question.maxLength}
                value={value}
                onChange={(event) => answer(question.id, event.target.value)}
                aria-invalid={bad(id)}
              />
            ) : (
              <Input
                id={id}
                type={question.kind === "link" ? "url" : "text"}
                inputMode={question.kind === "link" ? "url" : undefined}
                placeholder={question.kind === "link" ? "https://" : undefined}
                maxLength={question.maxLength}
                value={value}
                onChange={(event) => answer(question.id, event.target.value)}
                aria-invalid={bad(id)}
              />
            )}
            {help}
            <Required show={bad(id)}>{t("required")}</Required>
          </Field>
        );
      })}
    </>
  );
}

function StepReview({
  view,
  draft,
  solution,
  steps,
  edit,
  confirmed,
  confirm,
  bad,
}: {
  view: ApplicationView;
  draft: ApplyDraft;
  solution: SolutionDraft;
  steps: StepKey[];
  edit: (index: number) => void;
  confirmed: boolean;
  confirm: (value: boolean) => void;
  bad: Bad;
}) {
  const t = useTranslations("Apply.review");
  const you = useTranslations("Apply.you");
  const typeName = useVocabulary("organizationType");
  const sizeName = useVocabulary("teamSize");
  const maturity = useVocabulary("maturity");
  const countryName = useCountryName();
  const contact = draft.contact;
  const organization = view.organization;
  const none = t("notAdded");

  const blocks: { step: Exclude<StepKey, "review">; rows: [string, string][] }[] = [
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
      <Field orientation="horizontal" data-invalid={bad("confirm")}>
        <Checkbox
          id="confirm"
          checked={confirmed}
          onCheckedChange={(checked) => confirm(checked === true)}
          aria-invalid={bad("confirm")}
        />
        <FieldContent>
          <FieldLabel htmlFor="confirm">{t("confirm")}</FieldLabel>
          <Required show={bad("confirm")}>{t("confirmRequired")}</Required>
        </FieldContent>
      </Field>
    </>
  );
}

export { ApplyFlow };
