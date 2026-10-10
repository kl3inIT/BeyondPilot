"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { LeaveGuard } from "@/components/composites/leave-guard";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { useFieldValidity } from "@/components/form/form-context";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { SettingsBlock } from "@/features/ai/settings-block";
import { MatchingAdminTabs } from "@/features/matching/matching-admin-tabs";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import {
  getMatchingSettings,
  saveMatchingSettings,
  type MatchingSettings,
  type SaveMatchingSettings,
} from "@/lib/api/generated";

/** What the backend accepts for each limit (`SaveMatchingSettingsRequest`); a refusal there is a 400. */
const ranges = {
  parallel: { min: 1, max: 16 },
  candidates: { min: 5, max: 200 },
  settleMinutes: { min: 0, max: 1440 },
  editRunsPerDay: { min: 0, max: 100 },
  memberRunsPerDay: { min: 0, max: 100 },
  runsPerDay: { min: 1, max: 100_000 },
} as const;

type Limit = keyof typeof ranges;

/** The form's values: every limit as text, so a field is never uncontrolled and may stand empty. */
type Values = Record<Limit, string>;

/** The unit each limit is counted in, beside its number. */
const units = {
  parallel: "solutions",
  candidates: "solutions",
  settleMinutes: "minutes",
  editRunsPerDay: "runs",
  memberRunsPerDay: "runs",
  runsPerDay: "runs",
} as const satisfies Record<Limit, string>;

function valuesOf(settings: MatchingSettings): Values {
  return {
    parallel: String(settings.parallel),
    candidates: String(settings.candidates),
    settleMinutes: String(settings.settleMinutes),
    editRunsPerDay: String(settings.editRunsPerDay),
    memberRunsPerDay: String(settings.memberRunsPerDay),
    // Spring answers null for a day without a ceiling.
    runsPerDay: settings.runsPerDay == null ? "" : String(settings.runsPerDay),
  };
}

/** The body the backend takes: an empty ceiling is no ceiling. */
function bodyOf(values: Values, version: number): SaveMatchingSettings {
  const ceiling = values.runsPerDay.trim();
  return {
    version,
    parallel: Number(values.parallel),
    candidates: Number(values.candidates),
    settleMinutes: Number(values.settleMinutes),
    editRunsPerDay: Number(values.editRunsPerDay),
    memberRunsPerDay: Number(values.memberRunsPerDay),
    ...(ceiling ? { runsPerDay: Number(ceiling) } : {}),
  };
}

/** Whether the text is a whole number the backend accepts for the limit. */
function within(limit: Limit, text: string) {
  const { min, max } = ranges[limit];
  return /^\d{1,6}$/.test(text) && Number(text) >= min && Number(text) <= max;
}

/**
 * One limit: its name, its number beside its unit and the range it may take, and what it does in
 * one sentence. Used inside `form.AppField`.
 */
function LimitField({
  label,
  unit,
  range,
  hint,
}: {
  label: string;
  unit: string;
  range: string;
  hint: string;
}) {
  const { field, invalid, errors } = useFieldValidity<string>();
  const rangeId = `${field.name}-range`;
  const hintId = `${field.name}-hint`;
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <InputGroup className="w-44 shrink-0">
          <InputGroupInput
            id={field.name}
            name={field.name}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={field.state.value}
            aria-invalid={invalid || undefined}
            aria-describedby={`${rangeId} ${hintId}`}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{unit}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <span id={rangeId} className="text-xs text-muted-foreground tabular-nums">
          {range}
        </span>
      </div>
      <FieldDescription id={hintId}>{hint}</FieldDescription>
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}

/**
 * Admin › AI › Matching, the Limits tab: the limits every run of matching works within, as one form. Saving sends
 * back the version that was read; when someone else saved meanwhile, the form takes their values
 * and says so, and the operator makes the change again.
 */
function MatchingSettingsPage({ settings }: { settings: MatchingSettings }) {
  const t = useTranslations("Admin.matching");
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const [current, setCurrent] = useState(settings);

  const range = (limit: Limit) => ({
    min: format.number(ranges[limit].min),
    max: format.number(ranges[limit].max),
  });
  const whole = (limit: Limit) =>
    z
      .string()
      .trim()
      .refine((text) => within(limit, text), t("outOfRange", range(limit)));

  const form = useAppForm({
    // What was last read or saved, so that a render after a save does not put the older values back.
    defaultValues: valuesOf(current),
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        parallel: whole("parallel"),
        candidates: whole("candidates"),
        settleMinutes: whole("settleMinutes"),
        editRunsPerDay: whole("editRunsPerDay"),
        memberRunsPerDay: whole("memberRunsPerDay"),
        runsPerDay: z
          .string()
          .trim()
          .refine(
            (text) => text === "" || within("runsPerDay", text),
            t("outOfRangeOrEmpty", range("runsPerDay")),
          ),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data } = await saveMatchingSettings({ body: bodyOf(value, current.version) });
        formApi.reset(valuesOf(data));
        setCurrent(data);
        notify.success("Admin.matching.saved");
        router.refresh();
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        if (code === "MATCHING_SETTINGS_CHANGED") {
          // Their values replace what was typed: saving over them is what the version prevents.
          const theirs = await getMatchingSettings()
            .then(({ data }) => data)
            .catch(() => undefined);
          if (theirs) {
            formApi.reset(valuesOf(theirs));
            setCurrent(theirs);
          }
          setServerErrors(formApi, {
            form: t(theirs ? "errors.changed" : "errors.changedReload"),
            fields: {},
          });
          return;
        }
        setServerErrors(formApi, {
          form: t(code === "REQUEST_INVALID" ? "errors.invalid" : "errors.unknown"),
          fields: {},
        });
      }
    },
  });
  // A number typed and then put back is no change: there is nothing to save or to lose.
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);

  const limit = (name: Limit) => (
    <form.AppField name={name}>
      {() => (
        <LimitField
          label={t(`fields.${name}.label`)}
          unit={t(`units.${units[name]}`)}
          range={t("range", range(name))}
          hint={t(`fields.${name}.hint`)}
        />
      )}
    </form.AppField>
  );

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageTitle destination="aiMatching">{t("title")}</AdminPageTitle>
      <MatchingAdminTabs current="limits" />
      <p className="max-w-prose text-sm text-muted-foreground">{t("lead")}</p>

      <form
        noValidate
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppForm>
          <form.FormError />
        </form.AppForm>

        <SettingsBlock
          id="matching-run"
          title={t("blocks.run.title")}
          lead={t("blocks.run.lead")}
          first
        >
          <FieldGroup className="max-w-xl">
            {limit("parallel")}
            {limit("candidates")}
          </FieldGroup>
        </SettingsBlock>

        <SettingsBlock
          id="matching-start"
          title={t("blocks.start.title")}
          lead={t("blocks.start.lead")}
        >
          <FieldGroup className="max-w-xl">{limit("settleMinutes")}</FieldGroup>
        </SettingsBlock>

        <SettingsBlock id="matching-day" title={t("blocks.day.title")} lead={t("blocks.day.lead")}>
          <FieldGroup className="max-w-xl">
            {limit("editRunsPerDay")}
            {limit("memberRunsPerDay")}
            {limit("runsPerDay")}
          </FieldGroup>
        </SettingsBlock>

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center">
          <form.AppForm>
            <form.SubmitButton disabled={!dirty}>{t("save")}</form.SubmitButton>
          </form.AppForm>
          <p className="text-xs text-muted-foreground">{t(dirty ? "unsaved" : "applies")}</p>
        </div>
      </form>

      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
    </div>
  );
}

export { MatchingSettingsPage };
