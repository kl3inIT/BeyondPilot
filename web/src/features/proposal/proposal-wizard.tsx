"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { CloudAlertIcon, CloudCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { useUnloadWarning } from "@/components/composites/leave-guard";
import { PdfUpload } from "@/components/composites/pdf-upload";
import { useAppForm } from "@/components/form/app-form";
import { focusFirstInvalidSoon } from "@/components/form/focus-first-invalid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { failedWith } from "@/lib/api/failure";
import { useRouter } from "@/i18n/navigation";
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
import { focusField } from "@/lib/focus-field";
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
import { proposalWords } from "./proposal-errors";
import { ProposalOrganizationStep } from "./proposal-organization-step";
import { ProposalDetailsStep } from "./proposal-details-step";
import { ProposalReviewStep } from "./proposal-review-step";
import { proposalStepSchemas, stepProblems } from "./proposal-schemas";
import { ProposalSolutionsStep } from "./proposal-solutions-step";
import { ProposalTeamStep } from "./proposal-team-step";

/** How long after the last change the draft is saved. */
const AUTOSAVE_MS = 800;

/**
 * What the form holds: the draft as it is saved, the details the account keeps, and the tick that
 * goes with sending.
 */
type ProposalFormValues = ProposalValues & { details: Details; confirmed: boolean };

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
  form: opened,
  organization,
  solutions,
  profile,
  account,
}: ProposalWizardProps) {
  const t = useTranslations("UseCaseProposal.wizard");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();
  const editing = opened.proposal?.status === "sent";
  const editableUntil = opened.proposal?.editableUntil ?? null;

  // As the proposal was read: what the form starts from, whatever is read afterwards. What the
  // account keeps comes first; the talent profile fills what it lacks, and everything stays editable.
  const [initial] = useState<ProposalFormValues>(() => ({
    ...valuesOf(opened.proposal),
    details: {
      name: account.displayName ?? profile?.name ?? "",
      country: account.country ?? profile?.country ?? "",
      phone: account.phone ?? "",
    },
    confirmed: false,
  }));
  const [catalog, setCatalog] = useState(solutions);
  const [step, setStep] = useState<Step>("organization");
  const [savedAt, setSavedAt] = useState<Date>(() =>
    opened.proposal ? new Date(opened.proposal.updatedAt) : new Date(),
  );
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const [changed, setChanged] = useState(false);
  // Whether the account lacks what the fields hold. It starts true when the talent profile filled a
  // field the account has not, and is true again after every change until the account keeps it; a
  // field's own `isDirty` never returns to false, so it cannot say this.
  const [detailsChanged, setDetailsChanged] = useState(
    () => !account.displayName || !account.country,
  );

  const version = useRef<number | null>(opened.proposal?.version ?? null);
  const proposalId = useRef<string | null>(opened.proposal?.id ?? null);
  // Whether something waits to be saved. It is not the form's `isDirty`, which compares with what
  // the form started from: a draft saved a moment ago differs from that and has nothing waiting.
  const dirty = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  const schemas = useMemo(
    () =>
      proposalStepSchemas(
        (key) =>
          ({
            solution: t("solutions.needed.solution"),
            approach: t("solutions.needed.approach"),
            required: t("details.required"),
            phoneInvalid: t("details.phoneInvalid"),
            role: t("team.needed.role"),
            primary: t("team.needed.primary"),
            deck: t("pdf.needed"),
          })[key],
      ),
    [t],
  );

  const form = useAppForm({
    defaultValues: initial,
    validationLogic: revalidateLogic(),
    // Going forward checks the step on the screen and nothing else; the last step has nothing to check.
    validators: {
      onDynamic: ({ value }) => {
        const fields = stepProblems(schemas, step, value);
        return fields ? { fields } : undefined;
      },
    },
    listeners: {
      onChange: ({ fieldApi }) => {
        if (fieldApi.name.startsWith("details.")) {
          // The details are the account's: they are kept when the step is left, not with the draft.
          setDetailsChanged(true);
        } else if (fieldApi.name !== "confirmed") {
          change();
        }
      },
    },
    // The upload marks no control as the one in error, so its button is given the focus by name.
    onSubmitInvalid: () => {
      if (step === "pdf") {
        focusField("proposal-deck");
      }
    },
    // Continue opens the next step; the list of steps names the one it opens.
    onSubmitMeta: {} as { to?: Step },
    onSubmit: async ({ meta }) => {
      const target = meta.to ?? (step === "review" ? null : steps[steps.indexOf(step) + 1]);
      if (target) {
        await open(target);
      } else if (editing) {
        await saveChanges();
      } else {
        await send();
      }
    },
  });
  const values = useStore(form.store, (held) => held.values);
  const { details, confirmed } = values;
  const submitting = useStore(form.store, (held) => held.isSubmitting);
  // A sent proposal is saved only on request, so "changed" is the form's own word for it.
  const edited = useStore(form.store, (held) => held.isDirty);

  async function saveOnce(): Promise<boolean> {
    dirty.current = false;
    setState("saving");
    try {
      const { data } = await saveUseCaseProposal({
        path: { useCaseId },
        body: bodyOf(form.state.values, version.current),
      });
      version.current = data.proposal?.version ?? version.current;
      proposalId.current = data.proposal?.id ?? proposalId.current;
      setSavedAt(new Date());
      setState("idle");
      return true;
    } catch (error) {
      if (failedWith(error, "PROPOSAL_CHANGED_MEANWHILE")) {
        // Saving again cannot help: the person must read the proposal as it stands now.
        stopped.current = true;
        setChanged(true);
      } else {
        notify.failure(error, proposalWords);
      }
      dirty.current = true;
      setState("failed");
      return false;
    }
  }

  /** Saves what is waiting and says whether it is saved. */
  function flush(): Promise<boolean> {
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
  }

  /** Notes that the draft changed and, unless it was sent, saves it once the person pauses. */
  function change() {
    if (stopped.current) {
      return;
    }
    dirty.current = true;
    clearTimeout(timer.current);
    if (!editing) {
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  // Closing or reloading the page between two saves asks first.
  useUnloadWarning(() => dirty.current);

  const stepIndex = steps.indexOf(step);
  const missing = incompleteSteps(values, detailsComplete(details));
  const done = (name: Step) =>
    name === "organization" || (name !== "review" && !missing.includes(name));

  /**
   * Keeps the details on the account as far as they are written; false when they cannot be kept
   * yet. Going forward has checked them all by then; going back keeps what there is, as a draft does.
   */
  async function saveDetails(): Promise<boolean> {
    if (!detailsChanged) {
      return true;
    }
    if (!phoneValid(details.phone)) {
      // The number says what is wrong with it, and takes the focus.
      void form.validateField("details.phone", "change");
      focusFirstInvalidSoon(() => document.getElementById(form.formId));
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
      notify.failure(error, proposalWords);
      return false;
    }
  }

  /**
   * Opens a step from the list, the review or Back. A later step is reached as Continue reaches it:
   * the step on the screen is checked first. An earlier one is always open to go back to.
   */
  async function go(target: Step) {
    // Without an organization there is nothing to write yet.
    if (!organization && target !== "organization") {
      return;
    }
    if (steps.indexOf(target) > stepIndex) {
      await form.handleSubmit({ to: target });
    } else {
      await open(target);
    }
  }

  /** Saves what the step on the screen holds, then shows the step asked for. */
  async function open(target: Step) {
    if (step === "details" && target !== "details" && !(await saveDetails())) {
      return;
    }
    if (await flush()) {
      setStep(target);
    }
  }

  async function leave() {
    if (!editing && organization) {
      // Saving to return later keeps the details and makes the draft, so the use case offers to continue it.
      if (!(await saveDetails())) {
        return;
      }
      if (proposalId.current === null) {
        dirty.current = true;
      }
    }
    if (await flush()) {
      // Cancelling an edit drops what was changed and returns to the proposal as sent.
      dirty.current = false;
      router.push(editing ? proposalViewRoute(useCaseId) : briefRoute(useCaseId));
    }
  }

  /** Saves every change to the sent proposal at once, then returns to it. */
  async function saveChanges() {
    try {
      if (!(await saveDetails())) {
        return;
      }
      const { data } = await saveUseCaseProposal({
        path: { useCaseId },
        body: bodyOf(form.state.values, version.current),
      });
      version.current = data.proposal?.version ?? version.current;
      dirty.current = false;
      stopped.current = true;
      notify.success("UseCaseProposal.wizard.edit.saved");
      router.push(proposalViewRoute(useCaseId));
    } catch (error) {
      const code = failedWith(error, "PROPOSAL_CHANGED_MEANWHILE", "PROPOSAL_EDIT_WINDOW_CLOSED");
      if (code === "PROPOSAL_CHANGED_MEANWHILE") {
        stopped.current = true;
        setChanged(true);
      } else if (code === "PROPOSAL_EDIT_WINDOW_CLOSED") {
        // The window ended while the form was open: the page reads the proposal and shows it as sent.
        dirty.current = false;
        notify.failure(error, proposalWords);
        router.refresh();
      } else {
        notify.failure(error, proposalWords);
      }
    }
  }

  async function send() {
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
      notify.failure(error, proposalWords);
    }
  }

  const time = format.dateTime(savedAt, "time");

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
      organizationName={opened.useCase.title}
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

      {/* The shell moves the focus here when the step changes. */}
      <h1 tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">
        {t(`steps.${step}`)}
      </h1>

      {organization ? (
        <form
          id={form.formId}
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            // A form in a dialog opened from here sends its own event up.
            if (event.target === event.currentTarget) {
              void form.handleSubmit();
            }
          }}
        >
          {step === "organization" && (
            <ProposalOrganizationStep
              useCaseId={useCaseId}
              organization={organization}
              accountName={account.displayName ?? account.email}
            />
          )}

          {step === "solutions" && (
            <ProposalSolutionsStep
              form={form}
              fields={{ solutionIds: "solutionIds", approach: "approach" }}
              catalog={catalog}
              organizationLogoFileId={organization.logoFileId}
              onCatalog={setCatalog}
            />
          )}

          {step === "details" && (
            <ProposalDetailsStep form={form} fields="details" email={account.email} />
          )}

          {step === "team" && (
            <ProposalTeamStep form={form} fields={{ team: "team" }} members={opened.members} />
          )}

          {step === "pdf" && (
            <form.Field name="deck">
              {(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={invalid || undefined}>
                    <PdfUpload
                      id="proposal-deck"
                      zone
                      value={field.state.value}
                      invalid={invalid}
                      describedBy={
                        invalid ? "proposal-deck-hint proposal-deck-error" : "proposal-deck-hint"
                      }
                      onChange={field.handleChange}
                    />
                    <FieldDescription id="proposal-deck-hint">{t("pdf.hint")}</FieldDescription>
                    {invalid && <FieldError id="proposal-deck-error">{t("pdf.needed")}</FieldError>}
                  </Field>
                );
              }}
            </form.Field>
          )}

          {step === "review" && (
            <>
              <ProposalReviewStep
                organization={organization}
                values={values}
                catalog={catalog}
                details={details}
                email={account.email}
                members={opened.members}
                onEdit={(target) => void go(target)}
              />
              {missing.length > 0 && (
                <Alert>
                  <AlertTitle>{t("review.missing")}</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 flex flex-col gap-1">
                      {missing.map((name) => (
                        <li key={name}>
                          <TextButton onClick={() => void go(name)}>
                            {t(`steps.${name}`)}
                          </TextButton>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {!editing && (
                <form.AppField name="confirmed">
                  {(field) => (
                    <field.CheckboxField
                      label={t("review.confirm")}
                      disabled={missing.length > 0}
                    />
                  )}
                </form.AppField>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <Button
              prominence="tertiary"
              size="lg"
              disabled={submitting}
              onClick={() => void leave()}
            >
              {editing ? t("edit.cancel") : t("saveAndReturn")}
            </Button>
            <div className="flex items-center gap-3">
              {stepIndex > 0 && (
                <Button
                  prominence="tertiary"
                  size="lg"
                  disabled={submitting}
                  onClick={() => void go(steps[stepIndex - 1])}
                >
                  {t("back")}
                </Button>
              )}
              <form.AppForm>
                {step === "review" ? (
                  <form.SubmitButton
                    size="lg"
                    disabled={
                      missing.length > 0 ||
                      (!editing && !confirmed) ||
                      changed ||
                      (editing && !edited)
                    }
                  >
                    {editing ? t("edit.save") : t("send")}
                  </form.SubmitButton>
                ) : (
                  <form.SubmitButton size="lg">{t("continue")}</form.SubmitButton>
                )}
              </form.AppForm>
            </div>
          </div>
        </form>
      ) : (
        // Without an organization there is nothing to write yet: its own form makes one.
        <ProposalOrganizationStep
          useCaseId={useCaseId}
          organization={null}
          accountName={account.displayName ?? account.email}
        />
      )}
    </WizardShell>
  );
}

export { ProposalWizard };
