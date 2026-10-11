"use client";

import { CloudAlertIcon, CloudCheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { PdfUpload } from "@/components/composites/pdf-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { Tick } from "@/features/usecase/wizard-fields";
import { WizardShell } from "@/features/usecase/wizard-shell";
import { TalentForm } from "@/features/talent/talent-form";
import {
  saveUseCaseProposal,
  sendUseCaseProposal,
  type ProposingOrganization,
  type SolutionSummary,
  type TalentProfile,
  type UseCaseProposalForm,
} from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { useCaseProposeRoute as proposeRoute, useCaseRoute as briefRoute } from "@/lib/site";

import {
  bodyOf,
  incompleteSteps,
  profileComplete,
  steps,
  valuesOf,
  type ProposalValues,
  type Step,
} from "./proposal-draft";
import { codeOfProposalError, describeProposalError } from "./proposal-errors";
import { ProposalOrganizationStep } from "./proposal-organization-step";
import { ProposalReviewStep } from "./proposal-review-step";
import { ProposalSolutionsStep } from "./proposal-solutions-step";
import { ProposalTeamStep } from "./proposal-team-step";

/** How long after the last change the draft is saved. */
const AUTOSAVE_MS = 800;

type ProposalWizardProps = {
  useCaseId: string;
  form: UseCaseProposalForm;
  /** The caller's organization; the wizard is only drawn for one that is approved. */
  organization: ProposingOrganization;
  /** What the organization offers, to resolve the solutions the proposal holds. */
  solutions: SolutionSummary[];
  /** The caller's talent profile, or none yet. */
  profile: TalentProfile | null;
  /** The name of the caller's account, to start a profile with. */
  accountName: string;
};

/**
 * The six steps in which a member of an approved organization writes a proposal to a use case. What is
 * written is saved as it changes, so nothing is lost and anyone of the organization can pick the draft
 * up; the last step reviews it and sends it.
 */
function ProposalWizard({
  useCaseId,
  form,
  organization,
  solutions,
  profile,
  accountName,
}: ProposalWizardProps) {
  const t = useTranslations("UseCaseProposal.wizard");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();

  const [values, setValues] = useState<ProposalValues>(() => valuesOf(form.proposal));
  const [catalog, setCatalog] = useState(solutions);
  const [step, setStep] = useState<Step>("organization");
  const [savedAt, setSavedAt] = useState<Date>(() =>
    form.proposal ? new Date(form.proposal.updatedAt) : new Date(),
  );
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const [changed, setChanged] = useState(false);
  const [checked, setChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);

  const latest = useRef(values);
  const version = useRef<number | null>(form.proposal?.version ?? null);
  const proposalId = useRef<string | null>(form.proposal?.id ?? null);
  const dirty = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  const saveOnce = useCallback(async (): Promise<boolean> => {
    dirty.current = false;
    setState("saving");
    try {
      const { data } = await saveUseCaseProposal({
        path: { useCaseId },
        body: bodyOf(latest.current, version.current),
      });
      version.current = data.proposal?.version ?? version.current;
      proposalId.current = data.proposal?.id ?? proposalId.current;
      setSavedAt(new Date());
      setState("idle");
      return true;
    } catch (error) {
      if (codeOfProposalError(error) === "PROPOSAL_CHANGED_MEANWHILE") {
        // Saving again cannot help: the person must read the proposal as it stands now.
        stopped.current = true;
        setChanged(true);
      } else {
        notify.error(describeProposalError(error));
      }
      dirty.current = true;
      setState("failed");
      return false;
    }
  }, [notify, useCaseId]);

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
    (patch: Partial<ProposalValues>) => {
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
  const complete = profileComplete(profile);
  const missing = incompleteSteps(values, complete);
  const done = (name: Step) =>
    name === "organization" || (name !== "review" && !missing.includes(name));

  async function go(target: Step) {
    if (await flush()) {
      setChecked(false);
      setStep(target);
      window.scrollTo({ top: 0 });
    }
  }

  /** Goes to the next step once this one has what a proposal needs. */
  async function next() {
    if (missing.includes(step)) {
      setChecked(true);
      return;
    }
    await go(steps[stepIndex + 1]);
  }

  async function leave() {
    if (await flush()) {
      router.push(briefRoute(useCaseId));
    }
  }

  async function send() {
    setSending(true);
    try {
      // A proposal that was never saved has no identity to send yet.
      if (proposalId.current === null) {
        dirty.current = true;
      }
      if (!(await flush()) || proposalId.current === null) {
        return;
      }
      await sendUseCaseProposal({ path: { id: proposalId.current } });
      stopped.current = true;
      router.push(`${proposeRoute(useCaseId)}/sent`);
    } catch (error) {
      notify.error(describeProposalError(error));
    } finally {
      setSending(false);
    }
  }

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
      title={t("headerTitle")}
      organizationName={form.useCase.title}
      status={saveStatus}
      steps={{
        names: steps,
        title: (name) => t(`steps.${name}`),
        heading: t("stepsHeading"),
      }}
      current={step}
      done={done}
      onStep={(name) => void go(name)}
      notes={[t("saveNote", { name: organization.name })]}
    >
      {changed && (
        <Alert variant="destructive">
          <AlertTitle>{t("changed")}</AlertTitle>
          <div className="mt-2">
            <Button prominence="secondary" size="sm" onClick={() => router.refresh()}>
              {t("reload")}
            </Button>
          </div>
        </Alert>
      )}

      {step === "profile" ? (
        <h1 className="sr-only">{t("steps.profile")}</h1>
      ) : (
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{t(`steps.${step}`)}</h1>
          <p className="text-base text-muted-foreground">{t(`leads.${step}`)}</p>
        </div>
      )}

      {step === "organization" && <ProposalOrganizationStep organization={organization} />}

      {step === "solutions" && (
        <ProposalSolutionsStep
          catalog={catalog}
          onCatalog={setCatalog}
          ids={values.solutionIds}
          onIds={(solutionIds) => change({ solutionIds })}
          approach={values.approach}
          onApproach={(approach) => change({ approach })}
          checked={checked}
        />
      )}

      {step === "profile" && (
        <TalentForm
          // A saved profile gets a fresh form, so it holds the new version.
          key={profile ? `${profile.version}-${profile.status}` : "new"}
          profile={profile}
          suggestedName={accountName}
          embedded={{
            onBack: () => void go("solutions"),
            onLeave: () => void leave(),
            onContinue: () => void go("team"),
          }}
        />
      )}

      {step === "team" && (
        <ProposalTeamStep
          members={form.members}
          team={values.team}
          onTeam={(team) => change({ team })}
          checked={checked}
        />
      )}

      {step === "pdf" && (
        <Field data-invalid={(checked && !values.deck) || undefined}>
          <PdfUpload
            id="proposal-deck"
            zone
            value={values.deck}
            invalid={checked && !values.deck}
            describedBy="proposal-deck-hint"
            onChange={(deck) => change({ deck })}
          />
          <FieldDescription id="proposal-deck-hint">{t("pdf.hint")}</FieldDescription>
          {checked && !values.deck && (
            <p role="alert" className="text-sm text-destructive">
              {t("pdf.needed")}
            </p>
          )}
        </Field>
      )}

      {step === "review" && (
        <>
          <ProposalReviewStep
            organization={organization}
            values={values}
            catalog={catalog}
            profile={profile}
            members={form.members}
            onEdit={(target) => void go(target)}
          />
          {missing.length > 0 && (
            <Alert>
              <AlertTitle>{t("review.missing")}</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 flex flex-col gap-1">
                  {missing.map((name) => (
                    <li key={name}>
                      <TextButton onClick={() => void go(name)}>{t(`steps.${name}`)}</TextButton>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <Tick
            label={t("review.confirm")}
            checked={confirmed}
            onCheckedChange={setConfirmed}
            disabled={missing.length > 0}
          />
        </>
      )}

      {step !== "profile" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
          <Button prominence="tertiary" size="lg" disabled={sending} onClick={() => void leave()}>
            {t("saveAndReturn")}
          </Button>
          <div className="flex items-center gap-3">
            {stepIndex > 0 && (
              <Button
                prominence="tertiary"
                size="lg"
                disabled={sending}
                onClick={() => void go(steps[stepIndex - 1])}
              >
                {t("back")}
              </Button>
            )}
            {step === "review" ? (
              <Button
                size="lg"
                pending={sending}
                disabled={missing.length > 0 || !confirmed || changed}
                onClick={() => void send()}
              >
                {t("send")}
              </Button>
            ) : (
              <Button size="lg" onClick={() => void next()}>
                {t("continue")}
              </Button>
            )}
          </div>
        </div>
      )}
    </WizardShell>
  );
}

export { ProposalWizard };
