"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { CloudAlertIcon, CloudCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { useUnloadWarning } from "@/components/composites/leave-guard";
import { useAppForm } from "@/components/form/app-form";
import { focusFirstInvalidSoon } from "@/components/form/focus-first-invalid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { failedWith } from "@/lib/api/failure";
import { useRouter } from "@/i18n/navigation";
import { WizardShell } from "@/features/usecase/wizard-shell";
import {
  getMyOrganization,
  saveUseCaseProposal,
  getUseCaseProposalForm,
  sendUseCaseProposal,
  updateMyContact,
  type Me,
  type OrganizationJoinRequest,
  type OrganizationMatch,
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
  incompleteSteps,
  phoneValid,
  steps,
  valuesOf,
  youComplete,
  type Details,
  type ProposalValues,
  type Step,
} from "./proposal-draft";
import { proposalWords } from "./proposal-errors";
import { ProposalReviewStep } from "./proposal-review-step";
import { proposalStepSchemas, stepProblems } from "./proposal-schemas";
import { ProposalSolutionsStep } from "./proposal-solutions-step";
import { ProposalYouStep } from "./proposal-you-step";

/** How long after the last change the draft is saved. */
const AUTOSAVE_MS = 800;

/**
 * What the form holds: the draft as it is saved, who sends it, the details the account keeps, and
 * the tick that goes with sending.
 */
type ProposalFormValues = ProposalValues & {
  details: Details;
  confirmed: boolean;
};

type ProposalWizardProps = {
  useCaseId: string;
  form: UseCaseProposalForm;
  /** The caller's organization, approved or waiting for review; none for a person who belongs to none yet. */
  organization: ProposingOrganization | null;
  /** The organization of the caller's email domain, offered when they look for theirs. */
  suggestion: OrganizationMatch | null;
  /** The request to join an organization that the caller waits on. */
  request: OrganizationJoinRequest | null;
  /** What the organization offers, to resolve the solutions the proposal holds. */
  solutions: SolutionSummary[];
  /** The caller's talent profile, or none yet. */
  profile: TalentProfile | null;
  /** The caller's account, whose name, address, country and number the proposal is sent with. */
  account: Me;
};

/**
 * The three steps in which a member of an organization, one still waiting for GenAI Fund's review included, writes a
 * proposal to a use case; a person in none makes theirs in the first. What is
 * written is saved as it changes, so nothing is lost and anyone of the organization can pick the draft
 * up; the last step reviews it and sends it.
 *
 * The same steps edit a proposal that was sent, while its edit window is open. Every save of a sent
 * proposal must be complete, so nothing is saved as it changes: the last step saves all the changes at
 * once.
 */
function ProposalWizardContent({
  useCaseId,
  form: opened,
  organization: organized,
  suggestion,
  request: requested,
  solutions,
  profile,
  account,
}: ProposalWizardProps) {
  const t = useTranslations("UseCaseProposal.wizard");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();
  const editing = opened.proposal?.status === "sent";
  // A proposal that was taken back is a draft again; the page says when, so the person knows why it is not sent.
  const withdrawnAt = opened.proposal?.withdrawnAt;
  const editableUntil = opened.proposal?.editableUntil ?? null;

  // As the proposal was read: what the form starts from, whatever is read afterwards. What the
  // account keeps comes first; the talent profile fills what it lacks, and everything stays editable.
  const [initial] = useState<ProposalFormValues>(() => ({
    ...valuesOf(opened.proposal),
    teamBackground: opened.proposal?.teamBackground ?? organized?.teamBackground ?? "",
    details: {
      name: account.displayName ?? profile?.name ?? "",
      country: account.country ?? profile?.country ?? "",
      phone: account.phone ?? "",
    },
    confirmed: false,
  }));
  const [catalog, setCatalog] = useState(solutions);
  const [step, setStep] = useState<Step>("you");
  // The organization the proposal is sent for: the caller's, or the one they make or join here.
  const organizationContext = useQuery({
    queryKey: ["proposal", useCaseId, "organization"],
    queryFn: async ({ signal }) => {
      const [{ data: mine }, { data: reread }] = await Promise.all([
        getMyOrganization({ signal }),
        getUseCaseProposalForm({ path: { useCaseId }, signal }),
      ]);
      return { organization: reread.organization ?? null, request: mine.request ?? null };
    },
    initialData: { organization: organized, request: requested },
    staleTime: 0,
    retry: false,
  });
  const { organization, request } = organizationContext.data;
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
            deck: t("solutions.needed.deck"),
            company: t("you.needed.company"),
            background: t("you.needed.background"),
          })[key],
        { organization: organization ? { team: organization.type === "builder_team" } : null },
      ),
    [t, organization],
  );

  const form = useAppForm({
    defaultValues: initial,
    validationLogic: revalidateLogic(),
    // Going forward checks the step on the screen and nothing else; the last step has nothing to check.
    validators: {
      onDynamic: ({ value }) => {
        const fields = stepProblems(schemas, step, value);
        if (!fields) return undefined;
        const { organization: missingOrganization, ...fieldProblems } = fields;
        return { fields: fieldProblems, form: missingOrganization?.message };
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
      const held = form.state.values;
      if (
        step === "solutions" &&
        !held.deck &&
        held.solutionIds.length > 0 &&
        held.approach.trim() !== ""
      ) {
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
  const youDone = youComplete(values, details, organization);
  const submitting = useStore(form.store, (held) => held.isSubmitting);
  // A sent proposal is saved only on request, so "changed" is whether the form differs from what
  // it opened with: a value changed and then put back is nothing to save.
  const edited = useStore(form.store, (held) => !held.isDefaultValue);

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
    // Without an organization there is nothing to save the draft to yet.
    if (stopped.current || !organization) {
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
  const missing = incompleteSteps(values, youDone);
  const done = (name: Step) => name !== "review" && !missing.includes(name);

  /** Reads what joining, asking or creating an organization made of the person. */
  async function readOrganization() {
    const previous = organization?.teamBackground ?? "";
    const { data } = await organizationContext.refetch({ throwOnError: true });
    // Only a still-unmodified default follows the organization; never overwrite a person's draft.
    if (
      !editing &&
      data?.organization &&
      (data.organization.teamBackground ?? "") !== form.state.values.teamBackground &&
      (form.state.values.teamBackground === previous || form.state.values.teamBackground === "")
    ) {
      form.setFieldValue("teamBackground", data.organization.teamBackground ?? "");
    }
    router.refresh();
  }

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
    if (steps.indexOf(target) > stepIndex) {
      await form.handleSubmit({ to: target });
    } else {
      await open(target);
    }
  }

  /** Saves what the step on the screen holds, then shows the step asked for. */
  async function open(target: Step) {
    if (step === "you" && target !== "you") {
      if (!organization || !(await saveDetails())) {
        return;
      }
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
      notes={
        editing
          ? [t("edit.note")]
          : withdrawnAt
            ? [t("withdrawnNote", { date: format.dateTime(new Date(withdrawnAt), "date") })]
            : []
      }
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
        {step === "you" && (
          <ProposalYouStep
            form={form}
            fields={{
              who: "who",
              teamName: "teamName",
              teamSize: "teamSize",
              teamBackground: "teamBackground",
              name: "details.name",
              country: "details.country",
              phone: "details.phone",
            }}
            organization={organization}
            suggestion={suggestion}
            request={request}
            email={account.email}
            onOrganized={readOrganization}
          />
        )}

        {step === "solutions" && organization && (
          <ProposalSolutionsStep
            form={form}
            fields={{ solutionIds: "solutionIds", approach: "approach", deck: "deck" }}
            catalog={catalog}
            organizationLogoFileId={organization.logoFileId}
            onCatalog={setCatalog}
          />
        )}

        {step === "review" && organization && (
          <>
            <ProposalReviewStep
              organization={organization}
              values={values}
              catalog={catalog}
              details={details}
              email={account.email}
              onEdit={(target) => void go(target)}
              onOrganized={readOrganization}
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
              <form.AppField name="confirmed">
                {(field) => (
                  <field.CheckboxField
                    label={t("review.confirm")}
                    required
                    disabled={missing.length > 0}
                  />
                )}
              </form.AppField>
            )}
          </>
        )}

        <form.AppForm>
          <form.FormError />
        </form.AppForm>
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
                <form.SubmitButton size="lg" disabled={step === "you" && !organization}>
                  {t("continue")}
                </form.SubmitButton>
              )}
            </form.AppForm>
          </div>
        </div>
      </form>
    </WizardShell>
  );
}

/** Query state belongs to this authenticated wizard, not a process-wide or cross-account cache. */
function ProposalWizard(props: ProposalWizardProps) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ProposalWizardContent {...props} />
    </QueryClientProvider>
  );
}

export { ProposalWizard };
