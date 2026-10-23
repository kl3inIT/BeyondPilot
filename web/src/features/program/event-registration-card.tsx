"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  CircleAlertIcon,
  CircleXIcon,
  HourglassIcon,
  ListOrderedIcon,
  MapPinIcon,
  VideoIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { ChoicesField } from "@/components/form/choices-field";
import { AllRequired } from "@/components/form/form-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ConsentDialog } from "@/features/identity/consent-dialog";
import {
  choicesOf,
  everything,
  type Choices,
  type ChoiceSource,
} from "@/features/identity/consent-choices";
import {
  requestSignInCode,
  verifySignInCode,
  type CodeCheckOutcome,
} from "@/features/identity/identity-api";
import { useFailureWords, useNotify } from "@/hooks/use-notify";
import { failedWith } from "@/lib/api/failure";
import {
  getMe,
  getMyConsent,
  recordMyConsent,
  registerForEvent,
  type Consent,
  type EventRegistration,
  type MyEventRegistration,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import {
  askedQuestions,
  eventDefaults,
  eventRequest,
  eventSchema,
  type EventValues,
} from "./event-answers";

const codeLength = 6;

/** Who is signed in, as the card needs them; null for a visitor. */
type Person = { name?: string | null; email: string; consentNeeded: boolean } | null;

type Step =
  | { kind: "form" }
  | { kind: "code"; email: string; values: EventValues }
  | { kind: "consent"; consent: Consent; values: EventValues };

/**
 * The card to register for an event of GenAI Fund's Luma calendar, on its page here (BEY-245), as
 * Luma's own: the event's questions, then for a visitor the code sent to their address, typed in the
 * same card, which signs them in; a new account agrees to how its data is used; then the
 * registration goes to GenAI Fund through Luma. Once registered, the card says where it stands.
 */
function EventRegistrationCard({
  slug,
  registration,
  person,
}: {
  slug: string;
  registration: EventRegistration;
  person: Person;
}) {
  const t = useTranslations("Program.event.card");
  const mine = registration.mine;
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t(mine ? "yours" : "title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {mine ? (
            <RegistrationStatus mine={mine} email={person?.email} registration={registration} />
          ) : registration.state === "closed" ? (
            <p className="text-sm text-muted-foreground">{t("closed")}</p>
          ) : (
            <RegistrationFlow slug={slug} registration={registration} person={person} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Where a registration stands, as Luma says it, with the ticket of a confirmed guest. */
function RegistrationStatus({
  mine,
  email,
  registration,
}: {
  mine: MyEventRegistration;
  email?: string;
  registration: EventRegistration;
}) {
  const t = useTranslations("Program.event.status");
  const state =
    mine.status === "approved"
      ? "approved"
      : mine.status === "declined"
        ? "declined"
        : mine.status === "waitlist"
          ? "waitlist"
          : mine.status === "received"
            ? "received"
            : "pending";
  const Icon = {
    approved: CalendarCheckIcon,
    declined: CircleXIcon,
    waitlist: ListOrderedIcon,
    received: HourglassIcon,
    pending: HourglassIcon,
  }[state];
  return (
    <div className="flex flex-col gap-4" role="status">
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={
            state === "approved"
              ? "mt-0.5 size-5 shrink-0 text-success"
              : state === "declined"
                ? "mt-0.5 size-5 shrink-0 text-destructive"
                : "mt-0.5 size-5 shrink-0 text-muted-foreground"
          }
        />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t(`${state}.title`)}</p>
          <p className="text-sm text-muted-foreground">
            {t(`${state}.lead`, { email: email ?? "" })}
          </p>
        </div>
      </div>
      {state === "approved" && mine.checkInImageUrl && (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-background p-4">
          <Image
            src={mine.checkInImageUrl}
            alt={t("approved.code")}
            width={200}
            height={200}
            unoptimized
            className="size-50"
          />
          <p className="text-center text-xs text-muted-foreground">{t("approved.codeHint")}</p>
        </div>
      )}
      {state === "approved" && (registration.venue || registration.meetingUrl) && (
        <p className="flex items-start gap-2 text-sm">
          {registration.meetingUrl ? (
            <>
              <VideoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <TextButton href={registration.meetingUrl} target="_blank" rel="noreferrer">
                {t("approved.join")}
              </TextButton>
            </>
          ) : (
            <>
              <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {registration.venue}
            </>
          )}
        </p>
      )}
      {state === "approved" && mine.calendarUrl && (
        <Button prominence="secondary" href={mine.calendarUrl}>
          <CalendarPlusIcon aria-hidden="true" />
          {t("approved.calendar")}
        </Button>
      )}
    </div>
  );
}

/**
 * The form, then for a visitor the code and, for a new account, the consent, all in the card. The
 * answers are kept while the person signs in, and sent once they are.
 */
function RegistrationFlow({
  slug,
  registration,
  person,
}: {
  slug: string;
  registration: EventRegistration;
  person: Person;
}) {
  const t = useTranslations("Program.event.card");
  const errors = useTranslations("Form.errors");
  const locale = useLocale();
  const router = useRouter();
  const notify = useNotify();
  const words = useFailureWords();
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [problem, setProblem] = useState<string | null>(null);
  const asked = askedQuestions(registration.questions);
  const schema = useMemo(
    () =>
      eventSchema(
        registration.questions,
        {
          required: errors("required"),
          tooLong: (max) => errors("tooLong", { max }),
          invalid: errors("invalid"),
          webAddress: errors("webAddress"),
          email: t("emailInvalid"),
        },
        person === null,
      ),
    [registration.questions, errors, t, person],
  );

  /** Sends the registration as the person now signed in; a refusal is said in the card. */
  async function register(values: EventValues, reload: boolean) {
    setProblem(null);
    try {
      await registerForEvent({
        path: { slug },
        body: eventRequest(registration.questions, values, registration.formVersion),
      });
      if (reload) {
        // A full load, so the header and every part of the page see the new session.
        window.location.reload();
      } else {
        router.refresh();
      }
    } catch (error) {
      setStep({ kind: "form" });
      if (
        failedWith(error, "PROGRAM_REGISTRATION_FORM_CHANGED") ||
        failedWith(error, "PROGRAM_REGISTRATION_EXISTS") ||
        failedWith(error, "PROGRAM_REGISTRATION_CLOSED")
      ) {
        setProblem(words(error));
        router.refresh();
      } else if (failedWith(error, "PROGRAM_REGISTRATION_ANSWERS_INVALID")) {
        setProblem(words(error));
      } else {
        notify.failure(error);
      }
    }
  }

  /** Signed in now: a new account agrees first, anyone else is registered at once. */
  async function signedIn(values: EventValues) {
    try {
      const { data: me } = await getMe();
      if (me.consentNeeded) {
        const { data: consent } = await getMyConsent();
        setStep({ kind: "consent", consent, values });
        return;
      }
    } catch (error) {
      notify.failure(error);
      return;
    }
    await register(values, true);
  }

  const form = useEventForm({
    defaultValues: eventDefaults(registration.questions, person ?? undefined),
    schema,
    onSubmit: async (value, formApi) => {
      if (person) {
        await (person.consentNeeded ? signedIn(value) : register(value, false));
        return;
      }
      const outcome = await requestSignInCode({ email: value.email.trim(), locale });
      if (outcome.kind === "sent") {
        setStep({ kind: "code", email: value.email.trim(), values: value });
      } else if (outcome.kind === "invalid") {
        setServerErrors(formApi, { fields: { email: { message: t("emailInvalid") } } });
      } else {
        setProblem(t(outcome.kind === "limited" ? "codeLimited" : "codeFailed"));
      }
    },
  });

  if (step.kind === "code") {
    return (
      <CodeStep
        email={step.email}
        onBack={() => setStep({ kind: "form" })}
        onSignedIn={() => void signedIn(step.values)}
      />
    );
  }
  if (step.kind === "consent") {
    return <ConsentStep consent={step.consent} onAgreed={() => void register(step.values, true)} />;
  }

  const submitLabel =
    registration.state === "waitlist"
      ? t("joinWaitlist")
      : registration.approval
        ? t("requestToJoin")
        : t("register");

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {registration.state === "waitlist" ? (
        <p className="text-sm text-muted-foreground">{t("full")}</p>
      ) : (
        registration.approval && <p className="text-sm text-muted-foreground">{t("approval")}</p>
      )}
      <AllRequired>
        <form.AppField name="name">
          {(field) => <field.TextField label={t("name")} autoComplete="name" maxLength={200} />}
        </form.AppField>
        {person ? (
          <p className="text-sm">
            <span className="text-muted-foreground">{t("emailAs")}</span>{" "}
            <span className="font-medium break-all">{person.email}</span>
          </p>
        ) : (
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label={t("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                description={t("emailHint")}
              />
            )}
          </form.AppField>
        )}
        {asked.map(({ question, key }) => (
          <QuestionField key={key} form={form} question={question} fieldKey={key} />
        ))}
      </AllRequired>
      {problem && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {problem}
        </p>
      )}
      <form.AppForm>
        <form.SubmitButton className="w-full">{submitLabel}</form.SubmitButton>
      </form.AppForm>
      <p className="text-xs text-muted-foreground">
        {t.rich("notice", {
          privacy: (chunks) => (
            <TextButton href={siteRoutes.privacy} className="whitespace-normal">
              {chunks}
            </TextButton>
          ),
        })}
      </p>
    </form>
  );
}

/** The registration form, a hook of its own so that a question's field can name its type. */
function useEventForm({
  defaultValues,
  schema,
  onSubmit,
}: {
  defaultValues: EventValues;
  schema: ReturnType<typeof eventSchema>;
  onSubmit: (values: EventValues, formApi: Parameters<typeof setServerErrors>[0]) => Promise<void>;
}) {
  return useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: ({ value, formApi }) => onSubmit(value, formApi),
  });
}

type EventForm = ReturnType<typeof useEventForm>;

/** One question of the host's, drawn by its type. */
function QuestionField({
  form,
  question,
  fieldKey,
}: {
  form: EventForm;
  question: EventRegistration["questions"][number];
  fieldKey: string;
}) {
  const t = useTranslations("Program.event.card");
  const optional = !question.required;
  if (question.type === "agree-check" || question.type === "terms") {
    return (
      <div className="flex flex-col gap-2">
        {question.type === "terms" && (question.termsText || question.termsUrl) && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{question.label}</p>
            {question.termsText ? (
              <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-line text-muted-foreground">
                {question.termsText}
              </p>
            ) : (
              question.termsUrl && (
                <TextButton href={question.termsUrl} target="_blank" rel="noreferrer">
                  {t("readTerms")}
                </TextButton>
              )
            )}
          </div>
        )}
        <form.AppField name={`agreed.${fieldKey}`}>
          {(field) => (
            <field.CheckboxField
              label={question.type === "terms" ? t("agreeTerms") : question.label}
              required={question.required}
            />
          )}
        </form.AppField>
      </div>
    );
  }
  if (question.type === "select" && question.multiple) {
    return (
      <form.AppField name={`answers.${fieldKey}`}>
        {() => (
          <ChoicesField
            id={`${form.formId}-${fieldKey}`}
            label={question.label}
            optional={optional}
            options={question.options}
          />
        )}
      </form.AppField>
    );
  }
  if (question.type === "select") {
    const options = question.options.map((option) => ({ value: option, label: option }));
    return (
      <form.AppField name={`answers.${fieldKey}`}>
        {(field) =>
          // A list too long to read whole, such as the countries, is searched as it is typed.
          options.length > 12 ? (
            <field.ComboboxField label={question.label} optional={optional} options={options} />
          ) : (
            <field.SelectField
              label={question.label}
              optional={optional}
              options={options}
              placeholder={t("choose")}
            />
          )
        }
      </form.AppField>
    );
  }
  if (question.type === "company") {
    return (
      <div className="flex flex-col gap-4">
        <form.AppField name={`answers.${fieldKey}`}>
          {(field) => (
            <field.TextField
              label={question.label}
              optional={optional}
              autoComplete="organization"
              maxLength={200}
            />
          )}
        </form.AppField>
        {question.jobTitle && (
          <form.AppField name={`jobTitles.${fieldKey}`}>
            {(field) => (
              <field.TextField
                label={t("jobTitle")}
                optional={optional}
                autoComplete="organization-title"
                maxLength={200}
              />
            )}
          </form.AppField>
        )}
      </div>
    );
  }
  if (question.type === "text" && question.multiline) {
    return (
      <form.AppField name={`answers.${fieldKey}`}>
        {(field) => (
          <field.TextareaField label={question.label} optional={optional} maxLength={10_000} />
        )}
      </form.AppField>
    );
  }
  const url = question.type === "url";
  const phone = question.type === "phone-number";
  return (
    <form.AppField name={`answers.${fieldKey}`}>
      {(field) => (
        <field.TextField
          label={question.label}
          optional={optional}
          type={url ? "url" : phone ? "tel" : "text"}
          inputMode={url ? "url" : phone ? "tel" : undefined}
          autoComplete={phone ? "tel" : undefined}
          placeholder={url ? "https://" : undefined}
          maxLength={url ? 2000 : question.type === "text" ? 1000 : 200}
        />
      )}
    </form.AppField>
  );
}

type Problem = Exclude<CodeCheckOutcome, "signed-in">;

/** The code sent to the address, typed in the card; a full code is checked at once. */
function CodeStep({
  email,
  onBack,
  onSignedIn,
}: {
  email: string;
  onBack: () => void;
  onSignedIn: () => void;
}) {
  const t = useTranslations("SignIn.sent");
  const card = useTranslations("Program.event.card");
  const errorId = useId();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const checking = useRef(false);
  const locked = problem === "locked";

  async function check(typed: string) {
    if (typed.length !== codeLength || checking.current) {
      return;
    }
    checking.current = true;
    setPending(true);
    const result = await verifySignInCode(typed);
    if (result === "signed-in") {
      onSignedIn();
      return;
    }
    checking.current = false;
    setPending(false);
    setProblem(result);
    setCode("");
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void check(code);
      }}
    >
      <p className="text-sm text-muted-foreground">
        {card("codeLead")}
        <span className="block font-medium break-all text-foreground">{email}</span>
      </p>
      <InputOTP
        maxLength={codeLength}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label={t("codeLabel")}
        aria-invalid={(problem !== null && problem !== "failed") || undefined}
        aria-describedby={problem ? errorId : undefined}
        disabled={locked || pending}
        value={code}
        onChange={(value) => {
          setCode(value);
          if (value.length > 0 && !locked) {
            setProblem(null);
          }
        }}
        onComplete={(value) => void check(value)}
        containerClassName="w-full"
      >
        {Array.from({ length: codeLength }, (_, index) => (
          <InputOTPGroup key={index} className="flex-1">
            <InputOTPSlot
              index={index}
              aria-invalid={(problem !== null && problem !== "failed") || undefined}
            />
          </InputOTPGroup>
        ))}
      </InputOTP>
      {problem && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`problem.${problem}`)}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        pending={pending}
        disabled={locked || code.length !== codeLength}
      >
        {card("codeContinue")}
      </Button>
      <TextButton size="sm" onClick={onBack} className="self-start">
        {card("codeBack")}
      </TextButton>
      <p className="text-xs text-muted-foreground">{t("validity")}</p>
    </form>
  );
}

/**
 * A new account agrees to how BeyondPilot uses its data before anything is sent, in the card: Accept
 * all, or a choice for each purpose in the full text, as on the consent page.
 */
function ConsentStep({ consent, onAgreed }: { consent: Consent; onAgreed: () => void }) {
  const t = useTranslations("Consent");
  const card = useTranslations("Program.event.card");
  const notify = useNotify();
  const [choosing, setChoosing] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(choices: Choices, source: ChoiceSource) {
    setPending(true);
    try {
      await recordMyConsent({ body: { ...choices, source } });
      onAgreed();
    } catch (error) {
      notify.failure(error, { otherwise: "Consent.failed" });
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{t("title")}</p>
      <p className="text-sm text-muted-foreground">
        {t.rich("lead", {
          terms: (chunks) => (
            <TextButton href={siteRoutes.terms} className="whitespace-normal">
              {chunks}
            </TextButton>
          ),
          privacy: (chunks) => (
            <TextButton href={siteRoutes.privacy} className="whitespace-normal">
              {chunks}
            </TextButton>
          ),
          text: (chunks) => (
            <TextButton className="whitespace-normal" onClick={() => setChoosing(true)}>
              {chunks}
            </TextButton>
          ),
        })}
      </p>
      <Button
        className="w-full"
        pending={pending && !choosing}
        disabled={pending}
        onClick={() => void save(everything, "accept_all")}
      >
        {card("acceptAndRegister")}
      </Button>
      <Button
        prominence="secondary"
        className="w-full"
        disabled={pending}
        onClick={() => setChoosing(true)}
      >
        {t("choose")}
      </Button>
      <ConsentDialog
        open={choosing}
        onOpenChange={setChoosing}
        consent={consent}
        initial={choicesOf(consent)}
        pending={pending}
        onSave={(choices, source) => void save(choices, source)}
      />
    </div>
  );
}

export { EventRegistrationCard };
