"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { ChoiceCardsField } from "@/components/form/form-fields";
import { useFailureWords, useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { failedWith } from "@/lib/api/failure";
import {
  createAdminPerk,
  createMyPerk,
  saveAdminPerk,
  saveMyPerk,
  type Perk,
  type PerkOptions,
  type SavePerk,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { instantInVietnam, partsInVietnam } from "@/lib/vietnam-time";

const ways = ["link", "code", "codes", "request"] as const;
const audiences = ["everyone", "members", "applicants", "shortlisted"] as const;

/** What the backend takes, as `SavePerkRequest` and `PerkQuestionEntry` hold it. */
const limits = {
  title: 80,
  value: 40,
  summary: 200,
  about: 4000,
  step: 300,
  steps: 10,
  terms: 4000,
  url: 2048,
  code: 200,
  question: 120,
  questions: 5,
  places: 100000,
  solutions: 20,
} as const;

type QuestionValues = { id: string | null; label: string; multiline: boolean; required: boolean };

/** What the form holds: the perk with its dates as days in Vietnam and its numbers as typed. */
type PerkValues = {
  title: string;
  value: string;
  summary: string;
  about: string;
  /** How to get it, one step a line. */
  steps: string;
  terms: string;
  termsUrl: string;
  audience: (typeof audiences)[number];
  programId: string;
  way: (typeof ways)[number];
  url: string;
  code: string;
  redeemUrl: string;
  questions: QuestionValues[];
  requireApproval: boolean;
  perPerson: boolean;
  places: string;
  startsOn: string;
  endsOn: string;
  solutionIds: string[];
  fromGenAiFund: boolean;
  shownOnProgramIds: string[];
};

function valuesOf(perk: Perk | undefined): PerkValues {
  return {
    title: perk?.title ?? "",
    value: perk?.value ?? "",
    summary: perk?.summary ?? "",
    about: perk?.about ?? "",
    steps: perk?.steps.join("\n") ?? "",
    terms: perk?.terms ?? "",
    termsUrl: perk?.termsUrl ?? "",
    audience: perk?.audience ?? "members",
    programId: perk?.programId ?? "",
    way: perk?.way ?? "link",
    url: perk?.url ?? "",
    code: perk?.code ?? "",
    redeemUrl: perk?.redeemUrl ?? "",
    questions: perk?.questions.map((question) => ({ ...question, id: question.id ?? null })) ?? [],
    requireApproval: perk?.requireApproval ?? true,
    perPerson: perk?.perPerson ?? false,
    places: perk?.places ? String(perk.places) : "",
    startsOn: perk?.startsAt ? partsInVietnam(perk.startsAt).day : "",
    endsOn: perk?.endsAt ? partsInVietnam(perk.endsAt).day : "",
    solutionIds: perk?.solutionIds ?? [],
    fromGenAiFund: perk?.fromGenAiFund ?? false,
    shownOnProgramIds: perk?.shownOnProgramIds ?? [],
  };
}

/** The text, or null when it is blank. */
const filled = (text: string) => text.trim() || null;

/** The perk to save from what the form holds; what its way does not use is left out. */
function bodyOf(values: PerkValues, version: number | undefined): SavePerk {
  const { way } = values;
  return {
    title: values.title.trim(),
    value: filled(values.value),
    summary: filled(values.summary),
    about: filled(values.about),
    steps: values.steps
      .split("\n")
      .map((step) => step.trim())
      .filter(Boolean),
    terms: filled(values.terms),
    termsUrl: filled(values.termsUrl),
    audience: values.audience,
    programId:
      values.audience === "applicants" || values.audience === "shortlisted"
        ? values.programId || null
        : null,
    way,
    url: way === "link" ? filled(values.url) : null,
    code: way === "code" ? filled(values.code) : null,
    redeemUrl: way === "code" || way === "codes" ? filled(values.redeemUrl) : null,
    questions:
      way === "request"
        ? values.questions.map((question) => ({ ...question, label: question.label.trim() }))
        : [],
    requireApproval: way === "request" && values.requireApproval,
    perPerson: values.perPerson,
    places: way !== "link" && values.places ? Number(values.places) : null,
    // A perk opens at the start of its first day and closes at the end of its last, in Vietnam.
    startsAt: values.startsOn ? instantInVietnam(values.startsOn, "00:00") : null,
    endsAt: values.endsOn ? instantInVietnam(values.endsOn, "23:59") : null,
    solutionIds: values.solutionIds,
    version: version ?? null,
  };
}

/** The refusals a field of the form is about, where it shows them. */
const refusalFields = {
  PERK_TITLE_TAKEN: "title",
  PERK_PROGRAM_NOT_FOUND: "programId",
  PERK_DATES_NOT_VALID: "endsOn",
  PERK_QUESTIONS_NOT_VALID: "questions",
  PERK_SOLUTION_NOT_USABLE: "solutionIds",
} as const;

const refusalCodes = Object.keys(refusalFields) as (keyof typeof refusalFields)[];

/** A section of the form under its heading. */
function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 border-t pt-6 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full text-lg font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Choices ticked among many: the solutions a perk goes with, the programs that show it. */
function Ticks({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <li key={option.id}>
            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={value.includes(option.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              />
              <span className="min-w-0 wrap-anywhere">{option.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PerkFormProps = {
  /** The perk to edit; none for a new one. */
  perk?: Perk;
  options: PerkOptions;
  /** `admin` for an operator, who also marks what GenAI Fund arranged and where it is shown. */
  side: "own" | "admin";
  /** For an operator's new perk: the organization that gives it. */
  organizationId?: string;
};

/**
 * The form of a perk: what it is, how it is got, who may get it and when, and the solutions it goes
 * with. Its partner and an operator fill the same fields; an operator also says whether GenAI Fund
 * arranged it and which programs show it. A new perk is saved as a draft and opens on its page.
 */
function PerkForm({ perk, options, side, organizationId }: PerkFormProps) {
  const t = useTranslations("Perk.form");
  const say = useTranslations("Form.errors");
  const notify = useNotify();
  const words = useFailureWords();
  const router = useRouter();

  const schema = useMemo(() => {
    const text = (max: number) => z.string().max(max, say("tooLong", { max }));
    const https = text(limits.url).refine(
      (value) => value.trim() === "" || /^https:\/\/\S+$/.test(value.trim()),
      t("errors.https"),
    );
    return z
      .object({
        title: text(limits.title).refine((value) => value.trim() !== "", say("required")),
        value: text(limits.value),
        summary: text(limits.summary),
        about: text(limits.about),
        steps: z.string().refine(
          (value) => {
            const lines = value.split("\n").filter((line) => line.trim() !== "");
            return (
              lines.length <= limits.steps && lines.every((line) => line.length <= limits.step)
            );
          },
          t("errors.steps", { count: limits.steps, max: limits.step }),
        ),
        terms: text(limits.terms),
        termsUrl: https,
        url: https,
        code: text(limits.code),
        redeemUrl: https,
        places: z
          .string()
          .refine(
            (value) =>
              value === "" ||
              (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= limits.places),
            say("positive"),
          ),
        questions: z.array(
          z.object({
            id: z.string().nullable(),
            label: text(limits.question).refine((value) => value.trim() !== "", say("required")),
            multiline: z.boolean(),
            required: z.boolean(),
          }),
        ),
        audience: z.enum(audiences),
        programId: z.string(),
        way: z.enum(ways),
        requireApproval: z.boolean(),
        perPerson: z.boolean(),
        startsOn: z.string(),
        endsOn: z.string(),
        solutionIds: z.array(z.string()),
        fromGenAiFund: z.boolean(),
        shownOnProgramIds: z.array(z.string()),
      })
      .superRefine((held, context) => {
        if (
          (held.audience === "applicants" || held.audience === "shortlisted") &&
          !held.programId
        ) {
          context.addIssue({ code: "custom", path: ["programId"], message: say("required") });
        }
        if (held.way === "link" && held.url.trim() === "") {
          context.addIssue({ code: "custom", path: ["url"], message: say("required") });
        }
        if (held.way === "code" && held.code.trim() === "") {
          context.addIssue({ code: "custom", path: ["code"], message: say("required") });
        }
        if (held.way === "request" && held.questions.length === 0) {
          context.addIssue({ code: "custom", path: ["questions"], message: t("errors.questions") });
        }
        if (held.startsOn && held.endsOn && held.endsOn < held.startsOn) {
          context.addIssue({ code: "custom", path: ["endsOn"], message: say("endsBeforeStarts") });
        }
      });
  }, [say, t]);

  const form = useAppForm({
    defaultValues: valuesOf(perk),
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      const body = bodyOf(value, perk?.version);
      try {
        if (side === "admin") {
          const admin = {
            perk: body,
            fromGenAiFund: value.fromGenAiFund,
            shownOnProgramIds: value.shownOnProgramIds,
          };
          if (perk) {
            await saveAdminPerk({ path: { id: perk.id }, body: admin });
          } else {
            const { data } = await createAdminPerk({ body: { ...admin, organizationId } });
            router.push(`${siteRoutes.adminPerks}/${data.id}`);
            return;
          }
        } else if (perk) {
          await saveMyPerk({ path: { id: perk.id }, body });
        } else {
          const { data } = await createMyPerk({ body });
          router.push(`${siteRoutes.workspacePerks}/${data.id}`);
          return;
        }
        notify.success("Perk.form.saved");
        router.refresh();
      } catch (error) {
        const refusal = failedWith(error, ...refusalCodes);
        if (refusal) {
          setServerErrors(form, {
            fields: { [refusalFields[refusal]]: { message: words(error) } },
          });
        } else {
          notify.failure(error);
        }
      }
    },
  });

  const way = useStore(form.store, (state) => state.values.way);
  const audience = useStore(form.store, (state) => state.values.audience);
  const chooseProgram = audience === "applicants" || audience === "shortlisted";
  const editable = perk?.editable ?? true;

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-8">
        <Part title={t("parts.what")}>
          <form.AppField name="title">
            {(field) => (
              <field.TextField label={t("title")} requiredMark maxLength={limits.title} />
            )}
          </form.AppField>
          <form.AppField name="value">
            {(field) => (
              <field.TextField
                label={t("value")}
                description={t("valueHint")}
                optional
                maxLength={limits.value}
              />
            )}
          </form.AppField>
          <form.AppField name="summary">
            {(field) => (
              <field.TextareaField
                label={t("summary")}
                optional
                rows={2}
                maxLength={limits.summary}
              />
            )}
          </form.AppField>
          <form.AppField name="about">
            {(field) => (
              <field.TextareaField label={t("about")} optional rows={5} maxLength={limits.about} />
            )}
          </form.AppField>
        </Part>

        <Part title={t("parts.how")}>
          <form.AppField name="way">
            {() => (
              <ChoiceCardsField
                label={t("way.label")}
                className="sm:grid-cols-2"
                options={ways.map((value) => ({
                  value,
                  label: t(`way.${value}.label`),
                  what: t(`way.${value}.what`),
                }))}
              />
            )}
          </form.AppField>
          {way === "link" && (
            <form.AppField name="url">
              {(field) => (
                <field.TextField
                  label={t("url")}
                  description={t("urlHint")}
                  requiredMark
                  type="url"
                  inputMode="url"
                  maxLength={limits.url}
                />
              )}
            </form.AppField>
          )}
          {way === "code" && (
            <form.AppField name="code">
              {(field) => (
                <field.TextField label={t("code")} requiredMark uncounted maxLength={limits.code} />
              )}
            </form.AppField>
          )}
          {way === "codes" && (
            <p className="text-sm text-muted-foreground">
              {t(side === "admin" ? "codesHint.admin" : "codesHint.own")}
            </p>
          )}
          {(way === "code" || way === "codes") && (
            <form.AppField name="redeemUrl">
              {(field) => (
                <field.TextField
                  label={t("redeemUrl")}
                  optional
                  type="url"
                  inputMode="url"
                  maxLength={limits.url}
                />
              )}
            </form.AppField>
          )}
          {way === "request" && (
            <>
              <form.Field name="questions" mode="array">
                {(list) => (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium">{t("questions.label")}</p>
                    <ol className="flex flex-col gap-3">
                      {list.state.value.map((_, index) => (
                        <li key={index} className="flex flex-col gap-3 rounded-xl border p-4">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <form.AppField name={`questions[${index}].label`}>
                                {(field) => (
                                  <field.TextField
                                    label={t("questions.question", { number: index + 1 })}
                                    requiredMark
                                    maxLength={limits.question}
                                  />
                                )}
                              </form.AppField>
                            </div>
                            <IconButton
                              className="mt-6"
                              aria-label={t("questions.remove", { number: index + 1 })}
                              onClick={() => list.removeValue(index)}
                            >
                              <Trash2Icon aria-hidden="true" />
                            </IconButton>
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-2">
                            <form.AppField name={`questions[${index}].multiline`}>
                              {(field) => <field.CheckboxField label={t("questions.multiline")} />}
                            </form.AppField>
                            <form.AppField name={`questions[${index}].required`}>
                              {(field) => <field.CheckboxField label={t("questions.required")} />}
                            </form.AppField>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {list.state.meta.errors.length > 0 && (
                      <p className="text-sm text-destructive">
                        {String(
                          (list.state.meta.errors[0] as { message?: string } | undefined)
                            ?.message ?? list.state.meta.errors[0],
                        )}
                      </p>
                    )}
                    {list.state.value.length < limits.questions && (
                      <Button
                        prominence="secondary"
                        size="sm"
                        className="self-start"
                        onClick={() =>
                          list.pushValue({ id: null, label: "", multiline: false, required: true })
                        }
                      >
                        <PlusIcon aria-hidden="true" />
                        {t("questions.add")}
                      </Button>
                    )}
                  </div>
                )}
              </form.Field>
              <form.AppField name="requireApproval">
                {(field) => <field.CheckboxField label={t("requireApproval")} />}
              </form.AppField>
            </>
          )}
          <form.AppField name="steps">
            {(field) => (
              <field.TextareaField
                label={t("steps")}
                description={t("stepsHint")}
                optional
                rows={4}
              />
            )}
          </form.AppField>
        </Part>

        <Part title={t("parts.who")}>
          <form.AppField name="audience">
            {(field) => (
              <field.SelectField
                label={t("audience.label")}
                options={audiences.map((value) => ({ value, label: t(`audience.${value}`) }))}
              />
            )}
          </form.AppField>
          {chooseProgram && (
            <form.AppField name="programId">
              {(field) => (
                <field.SelectField
                  label={t("program")}
                  placeholder={t("choose")}
                  requiredMark
                  options={options.programs.map(({ id, name }) => ({ value: id, label: name }))}
                />
              )}
            </form.AppField>
          )}
          <form.AppField name="perPerson">
            {(field) => <field.CheckboxField label={t("perPerson")} />}
          </form.AppField>
          {way !== "link" && (
            <form.AppField name="places">
              {(field) => (
                <field.TextField
                  label={t("places")}
                  description={t("placesHint")}
                  optional
                  inputMode="numeric"
                  uncounted
                  maxLength={6}
                />
              )}
            </form.AppField>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <form.AppField name="startsOn">
              {(field) => <field.TextField label={t("startsOn")} optional type="date" />}
            </form.AppField>
            <form.AppField name="endsOn">
              {(field) => (
                <field.TextField
                  label={t("endsOn")}
                  description={t("endsOnHint")}
                  optional
                  type="date"
                />
              )}
            </form.AppField>
          </div>
        </Part>

        <Part title={t("parts.terms")}>
          <form.AppField name="terms">
            {(field) => (
              <field.TextareaField label={t("terms")} optional rows={4} maxLength={limits.terms} />
            )}
          </form.AppField>
          <form.AppField name="termsUrl">
            {(field) => (
              <field.TextField
                label={t("termsUrl")}
                optional
                type="url"
                inputMode="url"
                maxLength={limits.url}
              />
            )}
          </form.AppField>
        </Part>

        {(options.solutions.length > 0 || side === "admin") && (
          <Part title={t("parts.shown")}>
            {options.solutions.length > 0 && (
              <form.Field name="solutionIds">
                {(field) => (
                  <Ticks
                    label={t("solutions")}
                    options={options.solutions.slice(0, limits.solutions)}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
            )}
            {side === "admin" && (
              <>
                <form.Field name="shownOnProgramIds">
                  {(field) => (
                    <Ticks
                      label={t("shownOnPrograms")}
                      options={options.programs}
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
                <form.AppField name="fromGenAiFund">
                  {(field) => <field.CheckboxField label={t("fromGenAiFund")} />}
                </form.AppField>
              </>
            )}
          </Part>
        )}
      </fieldset>

      {editable && (
        <div className="flex items-center gap-3 border-t pt-6">
          <form.AppForm>
            <form.SubmitButton>{t(perk ? "save" : "create")}</form.SubmitButton>
          </form.AppForm>
        </div>
      )}
    </form>
  );
}

export { PerkForm };
