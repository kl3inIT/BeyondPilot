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
import {
  saveUseCaseProposal,
  getUseCaseProposalForm,
  sendUseCaseProposal,
  updateMyContact,
  type Me,
  type ProposingOrganization,
  type SolutionSummary,
  type TalentProfile,
  type UseCaseProposalForm,
} from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { proposalViewRoute, proposeToUseCaseRoute as proposeRoute, briefRoute } from "@/lib/site";

import {
  bodyOf,
  detailsComplete,
  incompleteSteps,
  phoneValid,
  steps,
  valuesOf,
  type Details,
  type ProposalValues,
  type Step,
} from "./proposal-draft";
import { codeOfProposalError, describeProposalError } from "./proposal-errors";
import { ProposalOrganizationStep } from "./proposal-organization-step";
import { ProposalDetailsStep } from "./proposal-details-step";
import { ProposalReviewStep } from "./proposal-review-step";
import { ProposalSolutionsStep } from "./proposal-solutions-step";
import { ProposalTeamStep } from "./proposal-team-step";

/** How long after the last change the draft is saved. */
const AUTOSAVE_MS = 800;

type ProposalWizardProps = {
  useCaseId: string;
  form: UseCaseProposalForm;
  /** The caller's organization, approved or waiting for review; none for a person who belongs to none yet. */
  organization: ProposingOrganization | null;
  /** What the organization offers, to resolve the solutions the proposal holds. */
  solutions: SolutionSummary[];
  /** The caller's talent profile, or none yet. */
  profile: TalentProfile | null;
  /** The caller's account, whose name, address, country and number the proposal is sent with. */
  account: Me;
};

/**
 * The six steps in which a member of an organization, one still waiting for GenAI Fund's review included, writes a
 * proposal to a use case. What is
 * written is saved as it changes, so nothing is lost and anyone of the organization can pick the draft
 * up; the last step reviews it and sends it.
 *
 * The same steps edit a proposal that was sent, while its edit window is open. Every save of a sent
 * proposal must be complete, so nothing is saved as it changes: the last step saves all the changes at
 * once.
 */
function ProposalWizard({
  useCaseId,
  form,
  organization,
  solutions,
  profile,
  account,
}: ProposalWizardProps) {
  const t = useTranslations("UseCaseProposal.wizard");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();
  const editing = form.proposal?.status === "sent";
  const editableUntil = form.proposal?.editableUntil ?? null;

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
  const [details, setDetails] = useState<Details>(() => ({
    name: account.displayName ?? "",
    country: account.country ?? "",
    phone: account.phone ?? "",
  }));
  const [detailsChanged, setDetailsChanged] = useState(false);
  const [edited, setEdited] = useState(false);

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
    if (editing) {
      // A sent proposal is saved only by Save changes, never partway.
      return Promise.resolve(!stopped.current);
    }
    chain.current = chain.current.then(async () => {
      if (stopped.current) {
        return false;
      }
      return dirty.current ? saveOnce() : true;
    });
    return chain.current;
  }, [saveOnce, editing]);

  const change = useCallback(
    (patch: Partial<ProposalValues>) => {
      if (stopped.current) {
        return;
      }
      const next = { ...latest.current, ...patch };
      latest.current = next;
      dirty.current = true;
      setValues(next);
      setEdited(true);
      clearTimeout(timer.current);
      if (!editing) {
        timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
      }
    },
    [flush, editing],
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
  const missing = incompleteSteps(values, detailsComplete(details));
  const done = (name: Step) =>
    name === "organization" || (name !== "review" && !missing.includes(name));

  /** Keeps the details on the account; false when they cannot be kept yet. */
  async function saveDetails(): Promise<boolean> {
    if (!detailsChanged) {
      return true;
    }
    if (!phoneValid(details.phone)) {
      setChecked(true);
      return false;
    }
    try {
      await updateMyContact({
        body: {
          country: details.country || null,
          phone: details.phone.trim() || null,
          name: details.name.trim() || null,
        },
      });
      setDetailsChanged(false);
      return true;
    } catch (error) {
      notify.error(describeProposalError(error));
      return false;
    }
  }

  /** Fills the details from the talent profile; a name the account has is kept. */
  function fillFromProfile() {
    if (!profile) {
      return;
    }
    changeDetails({
      name: account.displayName ? details.name : (profile.name ?? details.name),
      country: profile.country ?? details.country,
      phone: details.phone,
    });
  }

  function changeDetails(next: Details) {
    setDetails(next);
    setDetailsChanged(true);
    setEdited(true);
  }

  async function go(target: Step) {
    // Without an organization there is nothing to write yet.
    if (!organization && target !== "organization") {
      return;
    }
    if (step === "details" && target !== "details" && !(await saveDetails())) {
      return;
    }
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
      // Cancelling an edit drops what was changed and returns to the proposal as sent.
      dirty.current = false;
      router.push(editing ? proposalViewRoute(useCaseId) : briefRoute(useCaseId));
    }
  }

  /** Saves every change to the sent proposal at once, then returns to it. */
  async function saveChanges() {
    setSending(true);
    try {
      if (!(await saveDetails())) {
        return;
      }
      const { data } = await saveUseCaseProposal({
        path: { useCaseId },
        body: bodyOf(latest.current, version.current),
      });
      version.current = data.proposal?.version ?? version.current;
      dirty.current = false;
      stopped.current = true;
      notify.success("UseCaseProposal.wizard.edit.saved");
      router.push(proposalViewRoute(useCaseId));
    } catch (error) {
      const code = codeOfProposalError(error);
      if (code === "PROPOSAL_CHANGED_MEANWHILE") {
        stopped.current = true;
        setChanged(true);
      } else if (code === "PROPOSAL_EDIT_WINDOW_CLOSED") {
        // The window ended while the form was open: the page reads the proposal and shows it as sent.
        dirty.current = false;
        notify.error(describeProposalError(error));
        router.refresh();
      } else {
        notify.error(describeProposalError(error));
      }
    } finally {
      setSending(false);
    }
  }

  async function send() {
    setSending(true);
    try {
      if (!(await saveDetails())) {
        return;
      }
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
      // The proposal may have gone out although the answer did not arrive: if it did, it is sent.
      const reread = await getUseCaseProposalForm({ path: { useCaseId } }).catch(() => null);
      if (reread?.data.proposal?.status === "sent") {
        stopped.current = true;
        router.push(`${proposeRoute(useCaseId)}/sent`);
        return;
      }
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

  const saveStatus = editing ? (
    <span role="status" className="text-xs text-muted-foreground">
      {edited ? t("edit.unsaved") : t("edit.pristine")}
    </span>
  ) : (
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
      notes={editing ? [t("edit.note")] : []}
    >
      {editing && editableUntil && (
        <Alert>
          <AlertTitle>{t("edit.title")}</AlertTitle>
          <AlertDescription>
            {t("edit.banner", {
              until: format.dateTime(new Date(editableUntil), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Ho_Chi_Minh",
              }),
            })}
          </AlertDescription>
        </Alert>
      )}

      {changed && (
        <Alert variant="destructive">
          <AlertTitle>{t("changed")}</AlertTitle>
          <div className="mt-2">
            <Button prominence="secondary" size="sm" onClick={() => window.location.reload()}>
              {t("reload")}
            </Button>
          </div>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t(`steps.${step}`)}</h1>
        {organization && step === "details" && profile && (
          <Button prominence="secondary" onClick={fillFromProfile}>
            {t("details.use")}
          </Button>
        )}
      </div>

      {step === "organization" && (
        <ProposalOrganizationStep
          useCaseId={useCaseId}
          organization={organization}
          accountName={account.displayName ?? account.email}
        />
      )}

      {organization && step === "solutions" && (
        <ProposalSolutionsStep
          catalog={catalog}
          organizationLogoFileId={organization.logoFileId}
          onCatalog={setCatalog}
          ids={values.solutionIds}
          onIds={(solutionIds) => change({ solutionIds })}
          approach={values.approach}
          onApproach={(approach) => change({ approach })}
          checked={checked}
        />
      )}

      {organization && step === "details" && (
        <ProposalDetailsStep
          details={details}
          onDetails={changeDetails}
          email={account.email}
          nameLocked={Boolean(account.displayName)}
          checked={checked}
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

      {organization && step === "review" && (
        <>
          <ProposalReviewStep
            organization={organization}
            values={values}
            catalog={catalog}
            details={details}
            email={account.email}
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
          {!editing && (
            <Tick
              label={t("review.confirm")}
              checked={confirmed}
              onCheckedChange={setConfirmed}
              disabled={missing.length > 0}
            />
          )}
        </>
      )}

      {organization && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
          <Button prominence="tertiary" size="lg" disabled={sending} onClick={() => void leave()}>
            {editing ? t("edit.cancel") : t("saveAndReturn")}
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
                disabled={
                  missing.length > 0 || (!editing && !confirmed) || changed || (editing && !edited)
                }
                onClick={() => void (editing ? saveChanges() : send())}
              >
                {editing ? t("edit.save") : t("send")}
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
