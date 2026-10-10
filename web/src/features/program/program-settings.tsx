"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { LockIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { setServerErrors, useAppForm, type ServerErrors } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import { saveProgram, type AdminProgram } from "@/lib/api/generated";
import { fieldOfPointer } from "@/lib/api/problem-fields";
import { programRoute, publicSiteHost, siteRoutes } from "@/lib/site";
import { instantInVietnam } from "@/lib/vietnam-time";

import { CoverUpload } from "./cover-upload";
import { programFormatter } from "./program-format";
import { programState } from "./program-labels";
import {
  missingToPublish,
  ProgramMenu,
  PublishButton,
  PublishChecklist,
} from "./program-publishing";
import {
  programTypes,
  settingsSchema,
  type EventValue,
  type KeyDateValue,
} from "./program-schemas";
import {
  eventOf,
  fieldOfCode,
  fieldOfMember,
  keyDateOf,
  saveBodyOf,
  settingsValuesOf,
} from "./program-values";
import { EventDialog, KeyDateDialog } from "./schedule-dialogs";

/**
 * One part of Settings: its title beside its fields, with what the title alone does not say, ruled
 * from the part above.
 */
function SettingsSection({
  title,
  what,
  children,
}: {
  title: string;
  what?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-x-12 gap-y-4 border-t pt-8 first:border-t-0 first:pt-0 lg:flex-row">
      <div className="flex flex-col gap-1 lg:w-72 lg:shrink-0">
        <h2 className="text-base font-medium">{title}</h2>
        {what && <p className="text-sm text-muted-foreground">{what}</p>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5 md:max-w-2xl">{children}</div>
    </section>
  );
}

/** The refusals of a save that Settings words itself. */
const refusals = [
  "PROGRAM_SLUG_TAKEN",
  "PROGRAM_SLUG_FIXED",
  "PROGRAM_DAYS_OUT_OF_ORDER",
  "PROGRAM_WINDOW_OUT_OF_ORDER",
  "PROGRAM_OUTCOMES_BEFORE_CLOSE",
  "PROGRAM_EXTERNAL_URL_REQUIRED",
  "PROGRAM_COVER_NOT_USABLE",
  "PROGRAM_KEY_DATE_OUT_OF_ORDER",
  "PROGRAM_EVENT_OUT_OF_ORDER",
  "PROGRAM_OPENING_FIXED",
  "PROGRAM_PUBLISHED_INCOMPLETE",
] as const;

function isRefusal(code: string): code is (typeof refusals)[number] {
  return (refusals as readonly string[]).includes(code);
}

/** Which key date or event a dialog edits: its place in the list, or a new one. */
type Editing = { index: number | null } | null;

/**
 * A program's Settings: everything a program is, saved together. A date or an event is edited in a
 * dialog and stored with the rest when Settings is saved; a refusal of the backend is shown beside
 * the field it concerns.
 */
/** `tabs` are the screens of the program, which the route renders on the server. */
function ProgramSettings({ program, tabs }: { program: AdminProgram; tabs: React.ReactNode }) {
  const t = useTranslations("Admin.programs.settings");
  const states = useTranslations("Admin.programs.state");
  const types = useTranslations("Program.type");
  const say = useTranslations("Form.errors");
  const format = programFormatter(useLocale());
  const notify = useNotify();
  const router = useRouter();
  const [keyDate, setKeyDate] = useState<Editing>(null);
  const [event, setEvent] = useState<Editing>(null);
  // The program as the last save answered it, for Save and publish; null when that save was refused.
  const saved = useRef<AdminProgram | null>(null);
  // The key dates and events as stored, to mark those added or changed since the last save.
  const [stored] = useState(() => {
    const values = settingsValuesOf(program);
    return {
      keyDates: new Set(values.keyDates.map((value) => JSON.stringify(value))),
      events: new Set(values.events.map((value) => JSON.stringify(value))),
    };
  });

  const form = useAppForm({
    defaultValues: settingsValuesOf(program),
    validationLogic: revalidateLogic(),
    validators: { onDynamic: settingsSchema(say) },
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data } = await saveProgram({ path: { id: program.id }, body: saveBodyOf(value) });
        saved.current = data;
        formApi.reset(settingsValuesOf(data));
        notify.success("Admin.programs.settings.saved");
        router.refresh();
      } catch (error) {
        saved.current = null;
        setServerErrors(formApi, refusal(error));
      }
    },
  });

  /** A refusal of the save as the form shows it: beside the field it concerns, or above the form. */
  function refusal(error: unknown): ServerErrors {
    const code = error instanceof ApiError ? error.code : undefined;
    if (!(error instanceof ApiError) || !code) {
      return { form: t("errors.unknown"), fields: {} };
    }
    if (code === "PROGRAM_CHANGED_MEANWHILE") {
      return { form: t("errors.changedMeanwhile"), fields: {} };
    }
    if (isRefusal(code)) {
      const field = fieldOfCode[code];
      const message = t(`errors.codes.${code}`);
      return field ? { fields: { [field]: { message } } } : { form: message, fields: {} };
    }
    const fields = Object.fromEntries(
      error.violations.flatMap((violation) => {
        const name = fieldOfMember(fieldOfPointer(violation.pointer));
        return name ? [[name, { message: say("invalid") }]] : [];
      }),
    );
    return Object.keys(fields).length > 0 ? { fields } : { form: t("errors.unknown"), fields: {} };
  }

  /** "7 Oct 2026, 15:30–17:00", "5 Dec 2026", from an instant and its end. */
  function when(startsAt: string, endsAt: string | null | undefined, allDay: boolean) {
    const starts = new Date(startsAt);
    const day = format.dateTime(starts, { day: "numeric", month: "short", year: "numeric" });
    if (allDay) {
      return day;
    }
    const time = (at: Date) =>
      format.dateTime(at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return endsAt ? `${day}, ${time(starts)}–${time(new Date(endsAt))}` : `${day}, ${time(starts)}`;
  }

  /** Saves Settings and answers the program as saved, or null when the form or the backend refused it. */
  async function save() {
    saved.current = null;
    await form.handleSubmit();
    return saved.current;
  }

  const dirty = useStore(form.store, (formState) => formState.isDirty);
  const blocked = useStore(
    form.store,
    (formState) => missingToPublish(formState.values).length > 0,
  );

  const draft = program.status === "draft";
  const state = programState({ status: program.status, phase: "upcoming" });

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-36 md:px-6 md:pb-12 lg:px-8"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
            <Badge variant={program.status === "published" ? "success" : state.variant}>
              {program.status === "published" ? t("published") : states("draft")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {dirty
              ? t("unsaved")
              : program.status === "published"
                ? t("context.published")
                : t("context.draft")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* With unsaved changes these move to the bar that stays at the foot of the screen. */}
          <div className={dirty ? "hidden" : "hidden items-center gap-2 md:flex"}>
            <form.AppForm>
              <form.SubmitButton prominence={draft ? "secondary" : "primary"}>
                {t("save")}
              </form.SubmitButton>
            </form.AppForm>
            {draft && (
              <PublishButton program={program} dirty={dirty} blocked={blocked} save={save} />
            )}
          </div>
          <Button prominence="secondary" href={programRoute(program.slug)}>
            {t(draft ? "preview" : "viewPage")}
          </Button>
          <ProgramMenu program={program} />
        </div>
      </div>

      <form.AppForm>
        <form.FormError />
      </form.AppForm>

      {draft && (
        <form.Subscribe selector={(formState) => missingToPublish(formState.values).join(" ")}>
          {(missing) =>
            (missing || program.publishIssues.length > 0) && (
              <PublishChecklist
                missing={missing ? (missing.split(" ") as typeof program.publishIssues) : []}
              />
            )
          }
        </form.Subscribe>
      )}

      {tabs}

      <div className="flex flex-col gap-8">
        <SettingsSection title={t("basics.title")}>
          <form.AppField name="name">
            {(field) => <field.TextField label={t("basics.name")} maxLength={120} />}
          </form.AppField>
          <form.AppField name="slug">
            {(field) => (
              <field.TextField
                label={t("basics.slug")}
                maxLength={60}
                spellCheck={false}
                disabled={program.slugFixed}
                description={t(program.slugFixed ? "basics.slugFixed" : "basics.slugHint", {
                  address: `${publicSiteHost}${siteRoutes.programs}/${field.state.value}`,
                })}
              />
            )}
          </form.AppField>
          <div className="grid gap-5 sm:grid-cols-2">
            <form.AppField name="type">
              {(field) => (
                <field.SelectField
                  label={t("basics.type")}
                  options={programTypes.map((value) => ({ value, label: types(value) }))}
                />
              )}
            </form.AppField>
            <form.AppField name="partnerName">
              {(field) => <field.TextField label={t("basics.partner")} optional maxLength={120} />}
            </form.AppField>
            <form.AppField name="startsOn">
              {(field) => <field.TextField label={t("basics.startsOn")} type="date" />}
            </form.AppField>
            <form.AppField name="endsOn">
              {(field) => <field.TextField label={t("basics.endsOn")} type="date" />}
            </form.AppField>
          </div>
          <form.AppField name="summary">
            {(field) => (
              <field.TextareaField
                label={t("basics.summary")}
                maxLength={300}
                description={t("basics.summaryHint")}
              />
            )}
          </form.AppField>
          <form.AppField name="about">
            {(field) => (
              <field.TextareaField
                label={t("basics.about")}
                optional
                maxLength={20000}
                className="min-h-32"
                description={t("basics.aboutHint")}
              />
            )}
          </form.AppField>
          <form.Field name="coverFileId">
            {(field) => {
              const errors = field.state.meta.errors.flatMap((error) =>
                error && typeof error === "object" && "message" in error
                  ? [{ message: String(error.message) }]
                  : [],
              );
              return (
                <Field data-invalid={errors.length > 0 || undefined}>
                  <FieldLabel htmlFor={field.name}>{t("basics.cover")}</FieldLabel>
                  <CoverUpload
                    id={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                    invalid={errors.length > 0}
                  />
                  <FieldError errors={errors} />
                </Field>
              );
            }}
          </form.Field>
        </SettingsSection>

        <SettingsSection title={t("page.title")}>
          <form.Field name="pageKind">
            {(field) => (
              <RadioGroup
                value={field.state.value}
                onValueChange={(kind) => field.handleChange(kind as typeof field.state.value)}
                aria-label={t("page.title")}
              >
                {(["standard", "custom", "external"] as const).map((kind) => (
                  <FieldLabel key={kind} htmlFor={`page-${kind}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{t(`page.${kind}.title`)}</FieldTitle>
                        <FieldDescription>{t(`page.${kind}.what`)}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={kind} id={`page-${kind}`} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            )}
          </form.Field>
          <form.Subscribe selector={(formState) => formState.values.pageKind}>
            {(kind) =>
              kind === "external" && (
                <form.AppField name="externalUrl">
                  {(field) => (
                    <field.TextField
                      label={t("page.externalUrl")}
                      type="url"
                      description={t("page.externalUrlHint")}
                    />
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
        </SettingsSection>

        <SettingsSection title={t("applications.title")} what={t("applications.what")}>
          <form.AppField name="takesApplications">
            {(field) => <field.CheckboxField label={t("applications.takes")} />}
          </form.AppField>
          <form.Subscribe selector={(formState) => formState.values.takesApplications}>
            {(takes) =>
              takes && (
                <>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                    <form.AppField name="opensDay">
                      {(field) => <field.TextField label={t("applications.opens")} type="date" />}
                    </form.AppField>
                    <form.AppField name="opensTime">
                      {(field) => <field.TextField label={t("applications.time")} type="time" />}
                    </form.AppField>
                    <form.AppField name="closesDay">
                      {(field) => <field.TextField label={t("applications.closes")} type="date" />}
                    </form.AppField>
                    <form.AppField name="closesTime">
                      {(field) => <field.TextField label={t("applications.time")} type="time" />}
                    </form.AppField>
                  </div>
                  <p className="-mt-3 text-sm text-muted-foreground">{t("applications.ict")}</p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <form.AppField name="shortlistSize">
                      {(field) => (
                        <field.TextField
                          label={t("applications.shortlist")}
                          optional
                          inputMode="numeric"
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="outcomesDueOn">
                      {(field) => (
                        <field.TextField label={t("applications.outcomes")} optional type="date" />
                      )}
                    </form.AppField>
                  </div>
                  <form.AppField name="allowUpdatesUntilClose">
                    {(field) => <field.CheckboxField label={t("applications.updates")} />}
                  </form.AppField>
                </>
              )
            }
          </form.Subscribe>
        </SettingsSection>

        <SettingsSection title={t("keyDates.title")} what={t("keyDates.what")}>
          <form.Subscribe
            selector={(formState) => ({
              keyDates: formState.values.keyDates,
              takes: formState.values.takesApplications,
              opens: [formState.values.opensDay, formState.values.opensTime],
              closes: [formState.values.closesDay, formState.values.closesTime],
              outcomes: formState.values.outcomesDueOn,
            })}
          >
            {({ keyDates, takes, opens, closes, outcomes }) => {
              // The window's dates belong in the timeline; they are edited under Applications.
              const locked = takes
                ? [
                    opens[0] &&
                      opens[1] && {
                        title: t("keyDates.opens"),
                        startsAt: instantInVietnam(opens[0], opens[1]),
                      },
                    closes[0] &&
                      closes[1] && {
                        title: t("keyDates.closes"),
                        startsAt: instantInVietnam(closes[0], closes[1]),
                      },
                    outcomes && {
                      title: t("keyDates.outcomes"),
                      startsAt: instantInVietnam(outcomes, "00:00"),
                      allDay: true,
                    },
                  ].filter((entry) => !!entry)
                : [];
              const rows = [
                ...locked.map((entry) => ({
                  ...entry,
                  endsAt: null,
                  allDay: "allDay" in entry,
                  index: null,
                  note: t("keyDates.fromWindow"),
                  unsaved: false,
                })),
                ...keyDates.map((value, index) => ({
                  ...keyDateOf(value),
                  index,
                  note: value.note || null,
                  unsaved: !stored.keyDates.has(JSON.stringify(value)),
                })),
              ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
              return (
                <ul className="flex flex-col border-b">
                  {rows.map((row) => (
                    <li
                      key={row.index === null ? `window-${row.title}` : `date-${row.index}`}
                      className="flex items-center gap-3 border-t py-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{row.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {[when(row.startsAt, row.endsAt, row.allDay), row.note]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      {row.unsaved && <Badge variant="outline">{t("notSaved")}</Badge>}
                      {row.index === null ? (
                        <LockIcon
                          className="size-4 text-muted-foreground"
                          aria-label={t("keyDates.locked")}
                        />
                      ) : (
                        <Button
                          prominence="tertiary"
                          size="sm"
                          aria-label={t("editNamed", { name: row.title })}
                          onClick={() => setKeyDate({ index: row.index })}
                        >
                          {t("edit")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              );
            }}
          </form.Subscribe>
          <div>
            <Button prominence="tertiary" size="sm" onClick={() => setKeyDate({ index: null })}>
              <PlusIcon aria-hidden="true" />
              {t("keyDates.add")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("keyDates.hint")}</p>
        </SettingsSection>

        <SettingsSection title={t("events.title")} what={t("events.what")}>
          <form.Subscribe selector={(formState) => formState.values.events}>
            {(events) =>
              events.length > 0 && (
                <ul className="flex flex-col border-b">
                  {events.map((value, index) => {
                    const saved = eventOf(value);
                    const where = value.online
                      ? t("events.online")
                      : [value.city, value.country].filter(Boolean).join(", ");
                    return (
                      <li key={`event-${index}`} className="flex items-center gap-3 border-t py-3">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium">{value.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {[when(saved.startsAt, saved.endsAt, false), where]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        {!stored.events.has(JSON.stringify(value)) && (
                          <Badge variant="outline">{t("notSaved")}</Badge>
                        )}
                        <Button
                          prominence="tertiary"
                          size="sm"
                          aria-label={t("editNamed", { name: value.title })}
                          onClick={() => setEvent({ index })}
                        >
                          {t("edit")}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )
            }
          </form.Subscribe>
          <div>
            <Button prominence="tertiary" size="sm" onClick={() => setEvent({ index: null })}>
              <PlusIcon aria-hidden="true" />
              {t("events.add")}
            </Button>
          </div>
        </SettingsSection>
      </div>

      {/*
        The actions stay at the foot of the screen while the form scrolls: always below 768px, and
        from there up while there are unsaved changes, which the header's own actions scroll away from.
      */}
      <div
        className={
          dirty
            ? "fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-6 md:sticky md:inset-x-auto md:-mx-6 md:flex-row md:items-center md:justify-end md:px-6 md:py-3 lg:-mx-8 lg:px-8"
            : "fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-6 md:hidden"
        }
      >
        {draft && (
          <form.Subscribe selector={(formState) => missingToPublish(formState.values).length}>
            {(missing) =>
              missing > 0 && (
                <a
                  href="#publish-checklist"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  {t("publish.missing", { count: missing })}
                </a>
              )
            }
          </form.Subscribe>
        )}
        <div className="flex gap-2">
          <form.AppForm>
            <form.SubmitButton className="flex-1" prominence={draft ? "secondary" : "primary"}>
              {t("save")}
            </form.SubmitButton>
          </form.AppForm>
          {draft && (
            <PublishButton
              className="flex-1"
              program={program}
              dirty={dirty}
              blocked={blocked}
              save={save}
            />
          )}
        </div>
      </div>

      <LeaveGuard
        active={dirty}
        back
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />

      {keyDate && (
        <KeyDateDialog
          value={
            keyDate.index === null ? null : (form.getFieldValue("keyDates")[keyDate.index] ?? null)
          }
          onClose={() => setKeyDate(null)}
          onSave={(value: KeyDateValue) => {
            const list = [...form.getFieldValue("keyDates")];
            if (keyDate.index === null) {
              list.push(value);
            } else {
              list[keyDate.index] = value;
            }
            form.setFieldValue("keyDates", list);
            setKeyDate(null);
          }}
          onDelete={
            keyDate.index === null
              ? undefined
              : () => {
                  form.setFieldValue(
                    "keyDates",
                    form.getFieldValue("keyDates").filter((_, index) => index !== keyDate.index),
                  );
                  setKeyDate(null);
                }
          }
        />
      )}
      {event && (
        <EventDialog
          value={event.index === null ? null : (form.getFieldValue("events")[event.index] ?? null)}
          onClose={() => setEvent(null)}
          onSave={(value: EventValue) => {
            const list = [...form.getFieldValue("events")];
            if (event.index === null) {
              list.push(value);
            } else {
              list[event.index] = value;
            }
            form.setFieldValue("events", list);
            setEvent(null);
          }}
          onDelete={
            event.index === null
              ? undefined
              : () => {
                  form.setFieldValue(
                    "events",
                    form.getFieldValue("events").filter((_, index) => index !== event.index),
                  );
                  setEvent(null);
                }
          }
        />
      )}
    </form>
  );
}

export { ProgramSettings };
