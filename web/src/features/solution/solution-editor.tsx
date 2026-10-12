"use client";

import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  CloudCheckIcon,
  InfoIcon,
  Loader2Icon,
  TimerIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore } from "@tanstack/react-form";
import { useLocale, useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { StepsNav } from "@/components/composites/steps-nav";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import { failedWith, failureKey } from "@/lib/api/failure";
import {
  publishAdminSolution,
  saveAdminSolutionDraft,
  saveSolution,
  submitSolution,
  type Solution,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { focusField } from "@/lib/focus-field";
import { siteRoutes } from "@/lib/site";

import { deckAddress } from "./solution-deck";
import { useSolutionForm } from "./solution-editor-form";
import {
  badLinks,
  contentOf,
  editorSteps,
  fieldId,
  fieldSteps,
  held,
  limits,
  linkFields,
  missingForReview,
  neededOf,
  reviewFields,
  toRequest,
  type EditorStep,
  type HeldImage,
  type SolutionDraft,
} from "./solution-editor-state";
import { BasicsStep, EvidenceStep, FitStep } from "./solution-editor-steps";
import { ReviewStep } from "./solution-review-step";

/** How long the editor waits after the last change before it saves a draft. */
const AUTOSAVE_DELAY_MS = 1200;

/** The heading of the step in view, which takes the focus when the step changes. */
const STEP_HEADING_ID = "solution-step-heading";

/** A save the backend refused: its words, what was being saved, and whether another save came first. */
type Failure = { message: MessageKey; content: string; conflict: boolean };

/**
 * The editor of a solution, in four steps. A draft, and a solution that was sent back, save as a
 * person types, because only their organization reads them. A solution in review or approved is
 * read by others, so its changes are kept only when the person chooses Save changes. The step is
 * part of the address, so the browser's Back returns to the step before.
 */
function SolutionEditor({
  solution,
  operator = false,
  onLeave,
}: {
  solution: Solution;
  /**
   * Set on the operators' page: the draft belongs to an organization, an operator writes it and
   * publishes it at once, with no review, so its calls and its way out are the operators'.
   */
  operator?: boolean;
  /**
   * Set when another page holds the editor, such as a dialog of a proposal: every way out of the editor
   * calls it instead of going to the list of solutions.
   */
  onLeave?: () => void;
}) {
  const t = useTranslations("Solution.editor");
  const site = useTranslations("Site");
  // A refusal is kept by its message key, so it is said in the reader's language when it is drawn.
  const say = useTranslations();
  const reviewStatus = useVocabulary("reviewStatus");
  const rejection = useVocabulary("solutionRejection");
  const takedown = useVocabulary("solutionTakedown");
  const format = useFormatter();
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();

  // What the backend last answered. The reference serves a save that follows another before a render.
  const [server, setServer] = useState(solution);
  const latest = useRef(solution);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNow, setSavedNow] = useState<Date | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [refused, setRefused] = useState<Set<string>>(new Set());
  // A field that changes is no longer marked: the backend's refusal was about what it held before.
  const form = useSolutionForm(solution, (field) =>
    setRefused((current) => {
      if (!current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.delete(field);
      return next;
    }),
  );
  const draft = useStore(form.store, (state) => state.values.solution);
  // The links a person has left: from then on, what is wrong with one is said under it. The form
  // keeps that as each field's blur; they are read as one word, which compares equal while unchanged.
  const leftLinks = useStore(form.store, (state) =>
    linkFields.filter((field) => state.fieldMeta[`solution.${field}`]?.isBlurred).join(" "),
  ).split(" ");
  const [checked, setChecked] = useState(false);
  // The person's word that what they wrote is right; a review is not sent without it.
  const [confirmed, setConfirmed] = useState(false);
  // The steps whose Continue was pressed while one of their fields was lacking.
  const [tried, setTried] = useState<Set<EditorStep>>(new Set());
  const [pending, setPending] = useState<"exit" | "save" | "submit" | null>(null);
  const [confirming, setConfirming] = useState<"submit" | null>(null);
  const [step, setStep] = useQueryState(
    "step",
    parseAsStringLiteral(editorSteps).withDefault("basics").withOptions({ history: "push" }),
  );
  const focusAfterStep = useRef<string | null>(null);
  const firstStep = useRef(true);

  const list = getPathname({
    href: operator ? siteRoutes.adminSolutions : siteRoutes.workspaceSolutions,
    locale,
  });
  /** Goes where the editor leads when it is done: the list of solutions, or back to what holds it. */
  const leave = () => (onLeave ? onLeave() : router.push(list));
  // A draft and a solution sent back are written step by step and sent for review at the end.
  const autosaves = server.status === "draft" || server.status === "needs_changes";
  // A solution refused for good stays as it was reviewed: it is read, never saved.
  const finallyRefused = server.status === "rejected";
  const standing = reviewState(server);
  const content = contentOf(draft);
  const dirty = content !== contentOf(held(server));
  const missing = missingForReview(draft);
  const wrongLinks = badLinks(draft);
  const nameless = draft.name.trim() === "";
  const saveable = !nameless && wrongLinks.length === 0;
  const stuck = failure !== null && failure.content === content;
  // What a review needs is asked for once the person has reached the review, or pressed Continue on
  // the step that holds it, not while they still write.
  const asked = (id: EditorStep) => checked || step === "review" || tried.has(id);
  const index = editorSteps.indexOf(step);

  /** What keeps a step from being left forward: a field a review needs, or a link that is no address. */
  function blockersOf(id: EditorStep): string[] {
    const lacking = reviewFields
      .filter((entry) => entry.step === id && missing.includes(entry.field))
      .map((entry) => entry.field);
    return id === "evidence" ? [...lacking, ...wrongLinks] : lacking;
  }

  /** An image under the cover whose upload ended; the list may have changed while it was on its way. */
  function addImage(image: HeldImage) {
    form.setFieldValue("solution.images", (current) =>
      current.length < limits.images ? [...current, image] : current,
    );
  }

  /** From now on the links that are no address say so, left or not: the person asked to go on. */
  function showWrongLinks() {
    wrongLinks.forEach((field) =>
      form.setFieldMeta(`solution.${field}`, (meta) => ({ ...meta, isBlurred: true })),
    );
  }

  async function send(body: SolutionDraft): Promise<boolean> {
    setSaving(true);
    try {
      const request = {
        path: { id: solution.id },
        body: toRequest(body, latest.current.version),
      };
      const { data } = operator
        ? await saveAdminSolutionDraft(request)
        : await saveSolution(request);
      latest.current = data;
      setServer(data);
      setSavedNow(new Date());
      setFailure(null);
      setRefused(new Set());
      // The deck the solution now names carries when it took it.
      form.setFieldValue(
        "solution.deck",
        (current) =>
          current && data.deck && current.fileId === data.deck.fileId ? data.deck : current,
        { dontUpdateMeta: true },
      );
      return true;
    } catch (error) {
      setRefused(rejectedFields(error));
      setFailure({
        message: failureKey(error, (key) => say.has(key)),
        content: contentOf(body),
        conflict: failedWith(error, "SOLUTION_CHANGED_MEANWHILE") !== undefined,
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  /**
   * Saves what the editor holds, after any save already on its way. True when the backend holds it.
   */
  async function persist(body: SolutionDraft): Promise<boolean> {
    while (inFlight.current) {
      await inFlight.current;
    }
    if (contentOf(body) === contentOf(held(latest.current))) {
      return true;
    }
    const sending = send(body);
    inFlight.current = sending;
    try {
      return await sending;
    } finally {
      inFlight.current = null;
    }
  }

  const autosave = useEffectEvent(() => {
    void persist(draft);
  });
  useEffect(() => {
    if (!autosaves || !dirty || saving || stuck || !saveable) {
      return;
    }
    const timer = window.setTimeout(autosave, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autosaves, dirty, saving, stuck, saveable, content]);

  // A new step starts at its heading, or at the field the person asked for.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const target = focusAfterStep.current;
    focusAfterStep.current = null;
    if (target) {
      focusField(target);
    } else {
      document.getElementById(STEP_HEADING_ID)?.focus();
    }
  }, [step]);

  /** Opens a step, with the focus on one of its fields when one is named. */
  function open(next: EditorStep, field?: string) {
    if (next === "review" || step === "review") {
      setChecked(true);
    }
    if (autosaves && dirty && saveable && !stuck) {
      void persist(draft);
    }
    if (next === step) {
      if (field) {
        focusField(field);
      }
      return;
    }
    focusAfterStep.current = field ?? null;
    void setStep(next);
  }

  /** Goes to the next step, or stays and marks what the step in view still lacks. */
  function next() {
    const blocking = blockersOf(step);
    if (blocking.length === 0) {
      open(editorSteps[index + 1]);
      return;
    }
    setTried((current) => new Set(current).add(step));
    showWrongLinks();
    const onlyLinks = blocking.every((field) => field === "demoUrl" || field === "website");
    notify.error(onlyLinks ? "Errors.REQUEST_INVALID" : "Solution.editor.stepIncomplete");
    focusField(fieldId(blocking[0]));
  }

  /** Shows what keeps the editor from saving: a missing name, or a link that is not an address. */
  function showWhatBlocks() {
    showWrongLinks();
    notify.error("Errors.REQUEST_INVALID");
    open(nameless ? "basics" : "evidence", fieldId(nameless ? "name" : wrongLinks[0]));
  }

  async function exit() {
    if (!saveable) {
      showWhatBlocks();
      return;
    }
    setPending("exit");
    if (await persist(draft)) {
      leave();
    } else {
      setPending(null);
    }
  }

  async function saveNow() {
    if (!saveable) {
      showWhatBlocks();
      return;
    }
    if (missing.length > 0) {
      // What others read keeps what a review needs.
      setChecked(true);
      notify.error("Errors.SOLUTION_INCOMPLETE");
      const first = reviewFields.find((entry) => entry.field === missing[0]);
      open(first?.step ?? "basics", fieldId(missing[0]));
      return;
    }
    setPending("save");
    if (await persist(draft)) {
      notify.success("Solution.done.saved");
    }
    setPending(null);
  }

  async function submit() {
    setPending("submit");
    try {
      if (!(await persist(draft))) {
        setConfirming(null);
        return;
      }
      if (operator) {
        await publishAdminSolution({ path: { id: solution.id } });
        notify.success("Solution.done.published", { name: draft.name.trim() });
        // What was published is read in the record of the review, with the rest of the solutions.
        router.push(getPathname({ href: `${siteRoutes.adminSolutions}/${solution.id}`, locale }));
      } else {
        await submitSolution({ path: { id: solution.id } });
        notify.success("Solution.done.submitted");
        leave();
      }
    } catch (error) {
      notify.failure(error);
      setConfirming(null);
    } finally {
      setPending(null);
    }
  }

  // What each field a review needs says while the draft lacks it, from the editor's schema.
  const needed = neededOf(draft, t);

  function errorOf(field: keyof SolutionDraft): string | undefined {
    if (field === "name") {
      return needed.name;
    }
    if (field === "demoUrl" || field === "website") {
      const shown = leftLinks.includes(field) || refused.has(field);
      return shown && wrongLinks.includes(field) ? t("fields.linkInvalid") : undefined;
    }
    const entry = reviewFields.find((candidate) => candidate.field === field);
    return entry && asked(entry.step) ? needed[entry.field] : undefined;
  }

  /** What a step still lacks or holds wrongly, as the line under its title; nothing when it is in order. */
  function problemOf(id: EditorStep): string | undefined {
    const wrong =
      [...refused].filter((field) => fieldSteps[field] === id).length +
      (id === "evidence"
        ? wrongLinks.filter((field) => leftLinks.includes(field) && !refused.has(field)).length
        : 0) +
      (id === "basics" && nameless && !refused.has("name") ? 1 : 0);
    if (wrong > 0) {
      return t("steps.toCheck", { count: wrong });
    }
    const lacking = reviewFields
      .filter(
        (entry) => entry.step === id && entry.field !== "name" && missing.includes(entry.field),
      )
      .map((entry) => entry.field);
    if (!asked(id) || lacking.length === 0) {
      return undefined;
    }
    // The images are named: "2 fields to add" would not say that a file is what is asked for.
    return id === "evidence"
      ? t("steps.evidence.toAdd", { missing: lacking.length > 1 ? "both" : lacking[0] })
      : t("steps.toAdd", { count: lacking.length });
  }

  /** Whether a step still lacks something a review needs; such a step is not shown as done. */
  const lacks = (id: EditorStep) =>
    reviewFields.some((entry) => entry.step === id && missing.includes(entry.field));

  const live = !autosaves;
  const stepTitle = (id: EditorStep) =>
    id === "review" && live ? t("steps.review.titleLive") : t(`steps.${id}.title`);
  // The review of a draft has no line under its title: the box below it says what happens next.
  const stepLead =
    step !== "review" ? t(`steps.${step}.lead`) : live ? t("steps.review.leadLive") : undefined;
  const savedAt = savedNow
    ? format.dateTime(savedNow, "time")
    : format.dateTime(new Date(server.updatedAt), {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
  // A draft that cannot be saved as it stands waits for the person; nothing has failed yet.
  const state = saving
    ? "saving"
    : stuck
      ? "failed"
      : !dirty
        ? "saved"
        : autosaves && saveable
          ? "saving"
          : "unsaved";
  const deckHref =
    draft.deck && draft.deck.fileId === server.deck?.fileId ? deckAddress(server.slug) : undefined;
  const last = index === editorSteps.length - 1;

  return (
    <div className="flex flex-1 flex-col bg-background md:bg-muted">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {site("skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-360 items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLockup showBackedBy={false} />
            <Separator
              orientation="vertical"
              className="max-md:hidden data-vertical:h-5 data-vertical:self-auto"
            />
            <p className="truncate text-sm font-medium text-muted-foreground max-md:hidden">
              {t("heading", { organization: server.organizationName, name: draft.name.trim() })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p
              role="status"
              hidden={finallyRefused}
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              {state === "saving" && (
                <>
                  <Loader2Icon
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">{t("state.saving")}</span>
                </>
              )}
              {state === "saved" && (
                <>
                  <CloudCheckIcon className="size-4 text-success" aria-hidden="true" />
                  <span className="text-muted-foreground max-sm:hidden">
                    {t(autosaves ? "state.draftSaved" : "state.saved", { time: savedAt })}
                  </span>
                  <span className="text-muted-foreground sm:hidden">
                    {t(autosaves ? "state.draftSavedShort" : "state.savedShort")}
                  </span>
                </>
              )}
              {state === "unsaved" && (
                <span className="text-muted-foreground">{t("state.unsaved")}</span>
              )}
              {state === "failed" && (
                <>
                  <CircleAlertIcon className="size-4 text-destructive" aria-hidden="true" />
                  <span className="text-destructive">{t("state.failed")}</span>
                </>
              )}
            </p>
            {state === "failed" &&
              (failure?.conflict ? (
                <TextButton size="sm" onClick={() => location.reload()}>
                  {t("state.reload")}
                </TextButton>
              ) : (
                <TextButton size="sm" onClick={() => void persist(draft)}>
                  {t("state.retry")}
                </TextButton>
              ))}
            {server.status === "draft" ? (
              <Badge variant="outline" className="max-lg:hidden">
                <ClockIcon aria-hidden="true" />
                {t("visibility.draft", { organization: server.organizationName })}
              </Badge>
            ) : (
              <span className="max-lg:hidden">
                <ReviewStatus state={standing}>{reviewStatus(standing)}</ReviewStatus>
              </span>
            )}
            {autosaves ? (
              <>
                <Button
                  prominence="secondary"
                  size="sm"
                  className="max-md:hidden"
                  pending={pending === "exit"}
                  disabled={pending !== null}
                  onClick={exit}
                >
                  {t("exit")}
                </Button>
                <IconButton
                  prominence="tertiary"
                  className="md:hidden"
                  aria-label={t("exit")}
                  disabled={pending !== null}
                  onClick={exit}
                >
                  <XIcon aria-hidden="true" />
                </IconButton>
              </>
            ) : (
              <>
                {!finallyRefused && (
                  <Button
                    size="sm"
                    pending={pending === "save"}
                    disabled={pending !== null || !dirty}
                    onClick={saveNow}
                  >
                    {t("save")}
                  </Button>
                )}
                <Button
                  prominence="tertiary"
                  size="sm"
                  {...(onLeave ? { onClick: onLeave } : { href: siteRoutes.workspaceSolutions })}
                >
                  {t("close")}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* A column below 1024px, so the bar of steps has the whole form to stick along. */}
      <main
        id="content"
        className="mx-auto flex w-full max-w-360 flex-1 gap-10 px-5 py-6 max-lg:flex-col max-lg:gap-6 md:px-8 md:py-8 lg:py-10"
      >
        {/*
          From 1024px the steps stay in view beside the form, under the header that sticks above
          them; below that they are the bar under that header. Both offsets are from the top of
          what scrolls the editor: the page, or the dialog of a proposal.
        */}
        <div className="flex w-70 shrink-0 flex-col gap-4 max-lg:contents lg:sticky lg:top-24 lg:self-start">
          {/* The steps show where the person is: the way forward is the editor's own Continue. */}
          <StepsNav
            label={t("steps.label")}
            heading={t("steps.label")}
            steps={editorSteps.map((id, position) => {
              const problem = problemOf(id);
              return {
                id,
                title: stepTitle(id),
                done: position < index && !problem && !lacks(id),
                problem,
              };
            })}
            current={step}
            doneLabel={t("steps.complete")}
            className="max-lg:top-14 max-lg:-mx-5 max-lg:-mt-6 max-lg:px-5 md:max-lg:-mx-8 md:max-lg:-mt-8 md:max-lg:px-8"
          />
          {live && (
            <p className="flex gap-2 rounded-xl border bg-background p-3 text-xs text-muted-foreground max-lg:hidden">
              <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {t("noteLive")}
            </p>
          )}
        </div>

        <div className="flex w-full min-w-0 flex-col gap-4 max-lg:mx-auto max-lg:max-w-170">
          {/* Below 1024px the header has no room for where the solution stands; it is said here. */}
          <div className="lg:hidden">
            {server.status === "draft" ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
                {t("visibility.draftShort", { organization: server.organizationName })}
              </p>
            ) : (
              <ReviewStatus state={standing}>{reviewStatus(standing)}</ReviewStatus>
            )}
          </div>
          {standing === "in_review" && (
            <Alert>
              <TimerIcon aria-hidden="true" />
              <AlertTitle>{t("in_review.title")}</AlertTitle>
              <AlertDescription>{t("in_review.lead")}</AlertDescription>
            </Alert>
          )}
          {standing === "approved" && (
            <Alert>
              <CircleCheckIcon aria-hidden="true" />
              <AlertTitle>{t(server.listed ? "approved.listed" : "approved.unlisted")}</AlertTitle>
              <AlertDescription>
                {!server.listed && <p>{t("approved.unlistedLead")}</p>}
                <TextButton href={`${siteRoutes.solutions}/${server.slug}`}>
                  {t("approved.open")}
                </TextButton>
              </AlertDescription>
            </Alert>
          )}
          {standing === "needs_changes" && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>{t("needsChanges.title")}</AlertTitle>
              <AlertDescription>
                {server.decisionMessage && <p>{server.decisionMessage}</p>}
                <p>{t("needsChanges.lead")}</p>
              </AlertDescription>
            </Alert>
          )}
          {standing === "rejected" && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>
                {t("rejected.title", { reason: rejection(server.decisionReason ?? "other") })}
              </AlertTitle>
              <AlertDescription>
                {server.decisionMessage && <p>{server.decisionMessage}</p>}
                <p>{t("rejected.lead")}</p>
              </AlertDescription>
            </Alert>
          )}
          {standing === "suspended" && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>
                {t("suspended.title", { reason: takedown(server.suspensionReason ?? "other") })}
              </AlertTitle>
              <AlertDescription>
                {server.suspensionMessage && <p>{server.suspensionMessage}</p>}
                <p>{t("suspended.lead")}</p>
              </AlertDescription>
            </Alert>
          )}
          {state === "failed" && failure && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>{t("state.failed")}</AlertTitle>
              <AlertDescription>{say(failure.message)}</AlertDescription>
            </Alert>
          )}

          <section className="flex flex-col gap-6 md:rounded-2xl md:border md:bg-card md:p-8 md:shadow-sm">
            <div className="flex flex-col gap-2">
              <h1
                id={STEP_HEADING_ID}
                tabIndex={-1}
                className="scroll-mt-20 text-2xl font-semibold tracking-tight outline-none max-lg:scroll-mt-32 md:text-3xl"
              >
                {stepTitle(step)}
              </h1>
              {stepLead && <p className="text-muted-foreground">{stepLead}</p>}
              {step !== "review" && (
                <p className="text-sm text-muted-foreground">
                  {t(step === "evidence" ? "imagesRequired" : "required")}
                </p>
              )}
            </div>

            {/* A refused solution is read as it was reviewed; its fields take no input. */}
            <fieldset disabled={finallyRefused} className="min-w-0">
              <FieldGroup>
                {step === "basics" && (
                  <BasicsStep
                    form={form}
                    errorOf={errorOf}
                    solutionId={solution.id}
                    operator={operator}
                  />
                )}
                {step === "fit" && <FitStep form={form} errorOf={errorOf} />}
                {step === "evidence" && (
                  <EvidenceStep
                    form={form}
                    errorOf={errorOf}
                    solutionId={solution.id}
                    deckHref={deckHref}
                    onImageAdded={addImage}
                    unsent={solution.status === "draft"}
                    customerDeployments={operator ? null : solution.customerDeployments}
                  />
                )}
                {step === "review" && (
                  <ReviewStep
                    form={form}
                    customerDeployments={
                      operator
                        ? null
                        : solution.customerDeployments.filter(
                            (deployment) => !deployment.withdrawnAt,
                          )
                    }
                    operator={operator}
                    missing={missing}
                    submittable={autosaves}
                    organizationName={server.organizationName}
                    slug={server.slug}
                    confirmed={confirmed}
                    onConfirmedChange={setConfirmed}
                    onOpen={open}
                  />
                )}
              </FieldGroup>
            </fieldset>

            {/* Below 1024px the note beside the steps is not drawn; the review's own lead says it. */}
            {live && !finallyRefused && step !== "review" && (
              <p className="text-xs text-muted-foreground lg:hidden">{t("noteLive")}</p>
            )}

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-background py-4 max-md:-mx-5 max-md:px-5 md:static md:bg-transparent md:pb-0">
              {index === 0 ? (
                autosaves ? (
                  <Button
                    prominence="secondary"
                    pending={pending === "exit"}
                    disabled={pending !== null}
                    onClick={exit}
                  >
                    {t("exit")}
                  </Button>
                ) : (
                  <Button
                    prominence="tertiary"
                    {...(onLeave ? { onClick: onLeave } : { href: siteRoutes.workspaceSolutions })}
                  >
                    {t("close")}
                  </Button>
                )
              ) : (
                <Button prominence="secondary" onClick={() => open(editorSteps[index - 1])}>
                  {t("previous")}
                </Button>
              )}
              {!last && (
                <Button size="lg" onClick={next}>
                  {t("continue")}
                </Button>
              )}
              {last && autosaves && (
                <Button
                  size="lg"
                  disabled={missing.length > 0 || !saveable || !confirmed || pending !== null}
                  onClick={() => setConfirming("submit")}
                >
                  {t(
                    operator
                      ? "review.publish"
                      : server.status === "needs_changes"
                        ? "review.resubmit"
                        : "review.submit",
                  )}
                </Button>
              )}
              {last && !autosaves && !finallyRefused && (
                <Button
                  size="lg"
                  pending={pending === "save"}
                  disabled={pending !== null || !dirty}
                  onClick={saveNow}
                >
                  {t("save")}
                </Button>
              )}
            </div>
          </section>
        </div>
      </main>

      {confirming === "submit" && (
        <ConfirmDialog
          open
          onOpenChange={() => setConfirming(null)}
          title={t(operator ? "review.confirmPublish.title" : "review.confirm.title")}
          description={t(operator ? "review.confirmPublish.lead" : "review.confirm.lead")}
          confirmLabel={t(operator ? "review.confirmPublish.confirm" : "review.confirm.confirm")}
          cancelLabel={t(operator ? "review.confirmPublish.cancel" : "review.confirm.cancel")}
          pending={pending === "submit"}
          onConfirm={submit}
        />
      )}
      <LeaveGuard
        active={dirty && pending === null}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
    </div>
  );
}

export { SolutionEditor };
