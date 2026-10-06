"use client";

import { CloudAlertIcon, CloudCheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { saveMyUseCase, submitMyUseCase, type MyUseCase } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { siteRoutes } from "@/lib/site";

import { describeUseCaseError, codeOfUseCaseError } from "./my-use-case-errors";
import {
  bodyOf,
  draftValuesOf,
  incompleteSteps,
  steps,
  type DraftValues,
  type Step,
} from "./use-case-draft";
import { UseCaseStepFields } from "./use-case-step-fields";
import { UseCaseSummary } from "./use-case-summary";
import { Tick } from "./wizard-fields";
import { WizardShell } from "./wizard-shell";

/** How long after the last change the draft is saved. */
const AUTOSAVE_MS = 800;

type Problem = "changed" | "locked" | null;

type UseCaseWizardProps = {
  useCase: MyUseCase;
};

/**
 * The five steps in which the members write a use case. What they write is saved as they type, so
 * nothing is lost and anyone of the organization can pick the draft up. The last step reviews it and
 * sends it to GenAI Fund. A published use case is edited the same way; its first save takes it out of
 * the directory.
 */
function UseCaseWizard({ useCase }: UseCaseWizardProps) {
  const t = useTranslations("Organization.useCases.wizard");
  const e = useTranslations("Organization.useCases.errors");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();

  const [values, setValues] = useState<DraftValues>(() => draftValuesOf(useCase));
  const [step, setStep] = useState<Step>("challenge");
  const [status, setStatus] = useState(useCase.status);
  const [changedSinceReview, setChangedSinceReview] = useState(useCase.changedSinceReview);
  const [savedAt, setSavedAt] = useState<Date>(() => new Date(useCase.updatedAt));
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const [problem, setProblem] = useState<Problem>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);

  const latest = useRef(values);
  const version = useRef(useCase.version);
  const dirty = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  const saveOnce = useCallback(async (): Promise<boolean> => {
    dirty.current = false;
    setState("saving");
    try {
      const { data } = await saveMyUseCase({
        path: { id: useCase.id },
        body: bodyOf(latest.current, version.current),
      });
      version.current = data.version;
      setStatus(data.status);
      setChangedSinceReview(data.changedSinceReview);
      setSavedAt(new Date());
      setState("idle");
      return true;
    } catch (error) {
      const code = codeOfUseCaseError(error);
      if (code === "USECASE_CHANGED_MEANWHILE" || code === "USECASE_NOT_EDITABLE") {
        // Saving again cannot help: the person must read the use case as it stands now.
        stopped.current = true;
        setProblem(code === "USECASE_CHANGED_MEANWHILE" ? "changed" : "locked");
      } else {
        notify.error(describeUseCaseError(error));
      }
      dirty.current = true;
      setState("failed");
      return false;
    }
  }, [notify, useCase.id]);

  /** Saves what is waiting and says whether it is saved. */
  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      if (stopped.current) {
        return false;
      }
      return dirty.current ? saveOnce() : true;
    });
    return chain.current;
  }, [saveOnce]);

  const change = useCallback(
    (patch: Partial<DraftValues>) => {
      if (stopped.current) {
        return;
      }
      const next = { ...latest.current, ...patch };
      latest.current = next;
      dirty.current = true;
      setValues(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  // Leaving the page with something unsaved asks first.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const stepIndex = steps.indexOf(step);
  const missing = incompleteSteps(values);
  const unchanged = status === "needs_changes" && !changedSinceReview;

  async function go(target: Step) {
    if (await flush()) {
      setStep(target);
      window.scrollTo({ top: 0 });
    }
  }

  async function leave() {
    if (await flush()) {
      router.push(siteRoutes.workspaceUseCases);
    }
  }

  async function submit() {
    setSending(true);
    try {
      if (!(await flush())) {
        return;
      }
      await submitMyUseCase({ path: { id: useCase.id } });
      stopped.current = true;
      router.push(`${siteRoutes.workspaceUseCases}/${useCase.id}/sent`);
    } catch (error) {
      notify.error(describeUseCaseError(error));
    } finally {
      setSending(false);
    }
  }

  const title = values.title.trim() || t("untitled");
  const time = format.dateTime(savedAt, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const saveStatus = (
    <span
      role="status"
      className={cn(
        "flex items-center gap-1.5 text-xs",
        state === "failed" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {state === "failed" ? (
        <CloudAlertIcon className="size-4" aria-hidden="true" />
      ) : (
        <CloudCheckIcon className="size-4 text-success" aria-hidden="true" />
      )}
      {state === "saving" ? t("saving") : state === "failed" ? t("notSaved") : t("saved", { time })}
    </span>
  );

  return (
    <WizardShell
      title={title}
      organizationName={useCase.organizationName}
      current={step}
      done={(name) => name !== "review" && !missing.includes(name)}
      onStep={(name) => void go(name)}
      notes={[t("saveNote", { name: useCase.organizationName }), t("reviewNote")]}
    >
      {problem === "changed" && (
        <Alert variant="destructive">
          <AlertTitle>{e("USECASE_CHANGED_MEANWHILE")}</AlertTitle>
          <div className="mt-2">
            <Button prominence="secondary" size="sm" onClick={() => router.refresh()}>
              {t("reload")}
            </Button>
          </div>
        </Alert>
      )}
      {problem === "locked" && (
        <Alert variant="destructive">
          <AlertTitle>{e("USECASE_NOT_EDITABLE")}</AlertTitle>
          <div className="mt-2">
            <Button prominence="secondary" size="sm" href={siteRoutes.workspaceUseCases}>
              {t("backToList")}
            </Button>
          </div>
        </Alert>
      )}
      {status === "needs_changes" && useCase.reviewNote && (
        <Alert>
          <AlertTitle>{t("sentBack.title")}</AlertTitle>
          <AlertDescription>{t("sentBack.note", { note: useCase.reviewNote })}</AlertDescription>
        </Alert>
      )}
      {status === "approved" && (
        <Alert>
          <AlertTitle>{t("editingPublished.title")}</AlertTitle>
          <AlertDescription>{t("editingPublished.description")}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t(`steps.${step}.title`)}</h1>
        <p className="text-base text-muted-foreground">{t(`steps.${step}.lead`)}</p>
        {step !== "review" && <p className="text-sm text-muted-foreground">{t("allRequired")}</p>}
      </div>

      {step !== "review" && <UseCaseStepFields step={step} values={values} onChange={change} />}

      {step === "review" && (
        <>
          <UseCaseSummary values={values} onEdit={(target) => void go(target)} />
          {missing.length > 0 && (
            <Alert>
              <AlertTitle>{t("missing.title")}</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 flex flex-col gap-1">
                  {missing.map((name) => (
                    <li key={name}>
                      <TextButton onClick={() => void go(name)}>
                        {t(`steps.${name}.title`)}
                      </TextButton>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {unchanged && (
            <Alert>
              <AlertTitle>{t("unchanged")}</AlertTitle>
            </Alert>
          )}
          <Tick
            label={t("confirm")}
            checked={confirmed}
            onCheckedChange={setConfirmed}
            disabled={missing.length > 0}
          />
        </>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-6">
        {stepIndex === 0 ? (
          <Button prominence="tertiary" onClick={() => void leave()}>
            {t("backToList")}
          </Button>
        ) : (
          <Button prominence="tertiary" onClick={() => void go(steps[stepIndex - 1])}>
            {t("back")}
          </Button>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saveStatus}
          <Button prominence="secondary" disabled={sending} onClick={() => void leave()}>
            {t("saveAndExit")}
          </Button>
          {step === "review" ? (
            <Button
              pending={sending}
              disabled={missing.length > 0 || !confirmed || problem !== null || unchanged}
              onClick={() => void submit()}
            >
              {t("submit")}
            </Button>
          ) : (
            <Button onClick={() => void go(steps[stepIndex + 1])}>{t("continue")}</Button>
          )}
        </div>
      </div>
    </WizardShell>
  );
}

export { UseCaseWizard };
