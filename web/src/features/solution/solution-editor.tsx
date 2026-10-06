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
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { ReviewStatus } from "@/components/composites/review-status";
import { StepItem } from "@/components/composites/step-item";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import { ApiError } from "@/lib/api/client";
import {
  deleteSolutionDraft,
  saveSolution,
  submitSolution,
  type Solution,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { focusField } from "@/lib/focus-field";
import { siteRoutes } from "@/lib/site";

import { deckAddress } from "./solution-deck";
import {
  badLinks,
  contentOf,
  editorSteps,
  fieldId,
  fieldSteps,
  held,
  missingForReview,
  reviewFields,
  toRequest,
  type EditorStep,
  type LinkField,
  type SolutionDraft,
} from "./solution-editor-state";
import { BasicsStep, EvidenceStep, FitStep } from "./solution-editor-steps";
import { solutionError } from "./solution-errors";
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
function SolutionEditor({ solution }: { solution: Solution }) {
  const t = useTranslations("Solution.editor");
  const site = useTranslations("Site");
  // A refusal is kept by its message key, so it is said in the reader's language when it is drawn.
  const say = useTranslations();
  const reviewStatus = useVocabulary("reviewStatus");
  const rejection = useVocabulary("solutionRejection");
  const format = useFormatter();
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();

  // What the backend last answered. The reference serves a save that follows another before a render.
  const [server, setServer] = useState(solution);
  const latest = useRef(solution);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [draft, setDraft] = useState(() => held(solution));
  const [saving, setSaving] = useState(false);
  const [savedNow, setSavedNow] = useState<Date | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [refused, setRefused] = useState<Set<string>>(new Set());
  const [leftLinks, setLeftLinks] = useState<Set<LinkField>>(new Set());
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState<"exit" | "save" | "submit" | "delete" | null>(null);
  const [confirming, setConfirming] = useState<"submit" | "delete" | null>(null);
  const [step, setStep] = useQueryState(
    "step",
    parseAsStringLiteral(editorSteps).withDefault("basics").withOptions({ history: "push" }),
  );
  const focusAfterStep = useRef<string | null>(null);
  const firstStep = useRef(true);

  const list = getPathname({ href: siteRoutes.workspaceSolutions, locale });
  const autosaves = server.status === "draft" || server.status === "rejected";
  const content = contentOf(draft);
  const dirty = content !== contentOf(held(server));
  const missing = missingForReview(draft);
  const wrongLinks = badLinks(draft);
  const nameless = draft.name.trim() === "";
  const saveable = !nameless && wrongLinks.length === 0;
  const stuck = failure !== null && failure.content === content;
  // What a review needs is asked for once the person has reached the review, not while they still write.
  const asking = checked || step === "review";
  const index = editorSteps.indexOf(step);

  function change(patch: Partial<SolutionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    // A field that changes is no longer marked: the backend's refusal was about what it held before.
    setRefused((current) => {
      const next = new Set(current);
      Object.keys(patch).forEach((field) => next.delete(field));
      return next.size === current.size ? current : next;
    });
  }

  async function send(body: SolutionDraft): Promise<boolean> {
    setSaving(true);
    try {
      const { data } = await saveSolution({
        path: { id: solution.id },
        body: toRequest(body, latest.current.version),
      });
      latest.current = data;
      setServer(data);
      setSavedNow(new Date());
      setFailure(null);
      setRefused(new Set());
      // The deck the solution now names carries when it took it.
      setDraft((current) =>
        current.deck && data.deck && current.deck.fileId === data.deck.fileId
          ? { ...current, deck: data.deck }
          : current,
      );
      return true;
    } catch (error) {
      setRefused(rejectedFields(error));
      setFailure({
        message: solutionError(error),
        content: contentOf(body),
        conflict: error instanceof ApiError && error.code === "SOLUTION_CHANGED_MEANWHILE",
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

  /** Shows what keeps the editor from saving: a missing name, or a link that is not an address. */
  function showWhatBlocks() {
    setLeftLinks(new Set(wrongLinks));
    notify.error("Solution.errors.REQUEST_INVALID");
    open(nameless ? "basics" : "evidence", fieldId(nameless ? "name" : wrongLinks[0]));
  }

  async function exit() {
    if (!saveable) {
      showWhatBlocks();
      return;
    }
    setPending("exit");
    if (await persist(draft)) {
      router.push(list);
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
      notify.error("Solution.errors.SOLUTION_INCOMPLETE");
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
      await submitSolution({ path: { id: solution.id } });
      notify.success("Solution.done.submitted");
      router.push(list);
    } catch (error) {
      notify.error(solutionError(error));
      setConfirming(null);
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("delete");
    try {
      await deleteSolutionDraft({ path: { id: solution.id } });
      notify.success("Solution.done.deleted", { name: solution.name });
      router.push(list);
    } catch (error) {
      notify.error(solutionError(error));
      setPending(null);
      setConfirming(null);
    }
  }

  function errorOf(field: keyof SolutionDraft): string | undefined {
    if (field === "name") {
      return nameless ? t("needed.name") : undefined;
    }
    if (field === "demoUrl" || field === "website") {
      const shown = leftLinks.has(field) || refused.has(field);
      return shown && wrongLinks.includes(field) ? t("fields.linkInvalid") : undefined;
    }
    const needed = missing.find((candidate) => candidate === field);
    return asking && needed && needed !== "name" ? t(`needed.${needed}`) : undefined;
  }

  /** What a step still lacks or holds wrongly, as the line under its title; nothing when it is in order. */
  function problemOf(id: EditorStep): string | undefined {
    const wrong =
      [...refused].filter((field) => fieldSteps[field] === id).length +
      (id === "evidence"
        ? wrongLinks.filter((field) => leftLinks.has(field) && !refused.has(field)).length
        : 0) +
      (id === "basics" && nameless && !refused.has("name") ? 1 : 0);
    if (wrong > 0) {
      return t("steps.toCheck", { count: wrong });
    }
    const lacking = reviewFields.filter(
      (entry) => entry.step === id && entry.field !== "name" && missing.includes(entry.field),
    ).length;
    return asking && lacking > 0 ? t("steps.toAdd", { count: lacking }) : undefined;
  }

  /** Whether a step still lacks something a review needs; such a step is not shown as done. */
  const lacks = (id: EditorStep) =>
    reviewFields.some((entry) => entry.step === id && missing.includes(entry.field));

  const live = !autosaves;
  const stepTitle = (id: EditorStep) =>
    id === "review" && live ? t("steps.review.titleLive") : t(`steps.${id}.title`);
  const stepMeta = (id: EditorStep) =>
    id === "review" && live ? t("steps.review.metaLive") : t(`steps.${id}.meta`);
  const stepLead = step === "review" && live ? t("steps.review.leadLive") : t(`steps.${step}.lead`);
  const savedAt = savedNow
    ? format.dateTime(savedNow, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
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
            <p role="status" className="flex items-center gap-1.5 text-xs font-medium">
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
                <ReviewStatus state={server.status}>{reviewStatus(server.status)}</ReviewStatus>
              </span>
            )}
            {autosaves ? (
              <>
                <Button
                  prominence="tertiary"
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
                <Button
                  size="sm"
                  pending={pending === "save"}
                  disabled={pending !== null || !dirty}
                  onClick={saveNow}
                >
                  {t("save")}
                </Button>
                <Button prominence="tertiary" size="sm" href={siteRoutes.workspaceSolutions}>
                  {t("close")}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="border-b bg-background px-5 py-3 md:px-8 lg:hidden">
        <div className="mx-auto flex w-full max-w-170 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium">
              {t("steps.progress", {
                step: index + 1,
                count: editorSteps.length,
                name: step === "review" ? t("steps.review.titleLive") : stepTitle(step),
              })}
            </p>
            {server.status === "draft" ? (
              <p className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                <ClockIcon className="size-3.5" aria-hidden="true" />
                {t("visibility.draftShort", { organization: server.organizationName })}
              </p>
            ) : (
              <ReviewStatus state={server.status}>{reviewStatus(server.status)}</ReviewStatus>
            )}
          </div>
          <Progress
            value={((index + 1) / editorSteps.length) * 100}
            aria-label={t("steps.label")}
          />
        </div>
      </div>

      <main
        id="content"
        className="mx-auto flex w-full max-w-260 flex-1 justify-center gap-10 px-5 py-6 md:px-8 md:py-8 lg:py-10"
      >
        <nav
          aria-label={t("steps.label")}
          className="flex w-70 shrink-0 flex-col gap-4 max-lg:hidden"
        >
          <p className="text-xs font-medium text-muted-foreground">{t("steps.label")}</p>
          <ol className="flex flex-col">
            {editorSteps.map((id, position) => {
              const problem = problemOf(id);
              return (
                <StepItem
                  key={id}
                  number={position + 1}
                  title={stepTitle(id)}
                  meta={problem ?? stepMeta(id)}
                  tone={problem ? "danger" : "default"}
                  state={
                    position === index
                      ? "current"
                      : position < index && !problem && !lacks(id)
                        ? "done"
                        : "upcoming"
                  }
                  doneLabel={t("steps.complete")}
                  last={position === editorSteps.length - 1}
                  onSelect={() => open(id)}
                />
              );
            })}
          </ol>
          <p className="flex gap-2 rounded-xl border bg-background p-3 text-xs text-muted-foreground">
            <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {t(autosaves ? "note" : "noteLive")}
          </p>
        </nav>

        <div className="flex w-full max-w-170 min-w-0 flex-col gap-4">
          {server.status === "submitted" && (
            <Alert>
              <TimerIcon aria-hidden="true" />
              <AlertTitle>{t("submitted.title")}</AlertTitle>
              <AlertDescription>{t("submitted.lead")}</AlertDescription>
            </Alert>
          )}
          {server.status === "approved" && (
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
          {server.status === "rejected" && (
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
                className="scroll-mt-20 text-2xl font-semibold tracking-tight outline-none md:text-3xl"
              >
                {stepTitle(step)}
              </h1>
              <p className="text-muted-foreground">{stepLead}</p>
              {step !== "review" && (
                <p className="text-sm text-muted-foreground">
                  {t(step === "evidence" ? "allOptional" : "required")}
                </p>
              )}
            </div>

            <FieldGroup>
              {step === "basics" && <BasicsStep draft={draft} change={change} errorOf={errorOf} />}
              {step === "fit" && <FitStep draft={draft} change={change} errorOf={errorOf} />}
              {step === "evidence" && (
                <EvidenceStep
                  draft={draft}
                  change={change}
                  errorOf={errorOf}
                  solutionId={solution.id}
                  deckHref={deckHref}
                  customerDeployments={solution.customerDeployments}
                  onLinkLeft={(field) => setLeftLinks((current) => new Set(current).add(field))}
                />
              )}
              {step === "review" && (
                <ReviewStep
                  draft={draft}
                  change={change}
                  customerDeployments={solution.customerDeployments}
                  missing={missing}
                  submittable={autosaves}
                  onOpen={open}
                />
              )}
            </FieldGroup>

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-background py-4 max-md:-mx-5 max-md:px-5 md:static md:bg-transparent md:pb-0">
              {index === 0 ? (
                autosaves ? (
                  <Button
                    prominence="tertiary"
                    pending={pending === "exit"}
                    disabled={pending !== null}
                    onClick={exit}
                  >
                    {t("exit")}
                  </Button>
                ) : (
                  <Button prominence="tertiary" href={siteRoutes.workspaceSolutions}>
                    {t("close")}
                  </Button>
                )
              ) : (
                <Button prominence="tertiary" onClick={() => open(editorSteps[index - 1])}>
                  {t("previous")}
                </Button>
              )}
              {!last && (
                <Button size="lg" onClick={() => open(editorSteps[index + 1])}>
                  {t("continue")}
                </Button>
              )}
              {last && autosaves && (
                <Button
                  size="lg"
                  disabled={missing.length > 0 || !saveable || pending !== null}
                  onClick={() => setConfirming("submit")}
                >
                  {t(server.status === "rejected" ? "review.resubmit" : "review.submit")}
                </Button>
              )}
              {last && !autosaves && (
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

          {last && server.status === "draft" && (
            <Button
              prominence="tertiary"
              tone="danger"
              size="sm"
              className="self-start"
              disabled={pending !== null}
              onClick={() => setConfirming("delete")}
            >
              {t("review.delete")}
            </Button>
          )}
        </div>
      </main>

      {confirming === "submit" && (
        <ConfirmDialog
          open
          onOpenChange={() => setConfirming(null)}
          title={t("review.confirm.title")}
          description={t("review.confirm.lead")}
          confirmLabel={t("review.confirm.confirm")}
          cancelLabel={t("review.confirm.cancel")}
          pending={pending === "submit"}
          onConfirm={submit}
        />
      )}
      {confirming === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={() => setConfirming(null)}
          title={t("review.confirmDelete.title", { name: solution.name })}
          description={t("review.confirmDelete.lead")}
          confirmLabel={t("review.confirmDelete.confirm")}
          cancelLabel={t("review.confirmDelete.cancel")}
          tone="danger"
          pending={pending === "delete"}
          onConfirm={remove}
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
