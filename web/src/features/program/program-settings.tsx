"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { ArrowUpRightIcon, LockIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { FeaturedBadge } from "@/components/composites/featured-badge";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { setServerErrors, useAppForm, type ServerErrors } from "@/components/form/app-form";
import { fieldIdOf, fieldIds } from "@/components/form/field-ids";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useFailureWords, useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import { failedWith, type ErrorCode } from "@/lib/api/failure";
import { saveProgram, type AdminProgram } from "@/lib/api/generated";
import { fieldOfPointer } from "@/lib/api/problem-fields";
import { programRoute, publicSiteHost, siteRoutes } from "@/lib/site";
import { instantInVietnam, partsInVietnam } from "@/lib/vietnam-time";

import { CoverUpload } from "./cover-upload";
import { programFormatter, vietnamDay } from "./program-format";
import { programStanding, programState } from "./program-labels";
import {
  missingToPublish,
  ProgramMenu,
  PublishButton,
  PublishChecklist,
} from "./program-publishing";
import {
  maxScheduleEntries,
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
import { EventDialog, KeyDateDialog, WindowTitleDialog } from "./schedule-dialogs";

/** The dates the application window puts on the timeline, by the field that holds each one's title. */
const windowTitles = {
  opens: "opensTitle",
  closes: "closesTitle",
  outcomes: "outcomesTitle",
} as const;

type WindowDate = keyof typeof windowTitles;

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

/**
 * A key date or an event as a row of its list: when it is comes first, at the size of the text
 * around it and in a column of its own from 640px, so a list is read down its dates and two entries
 * of one name are told apart at a glance.
 */
function ScheduleEntry({
  when,
  title,
  note,
}: {
  when: string;
  title: string;
  note?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-x-4 gap-y-0.5 sm:flex-row sm:items-baseline">
      <span className="text-sm tabular-nums sm:w-48 sm:shrink-0">{when}</span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium break-words">{title}</span>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
    </div>
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
  "PROGRAM_EVENT_CITY_REQUIRED",
  "PROGRAM_OPENING_FIXED",
  "PROGRAM_PUBLISHED_INCOMPLETE",
] as const satisfies readonly ErrorCode[];

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
  // The words a date of the window shows on the program's page until the operator gives it a title.
  const timeline = useTranslations("Program.timeline");
  const say = useTranslations("Form.errors");
  const format = programFormatter(useLocale());
  const notify = useNotify();
  const words = useFailureWords();
  const router = useRouter();
  const [keyDate, setKeyDate] = useState<Editing>(null);
  const [event, setEvent] = useState<Editing>(null);
  const [renaming, setRenaming] = useState<WindowDate | null>(null);
  const addKeyDate = useRef<HTMLButtonElement>(null);
  const addEvent = useRef<HTMLButtonElement>(null);
  // The program as the last save answered it, for Save and publish; null when that save was refused.
  const saved = useRef<AdminProgram | null>(null);
  // The key dates and events as stored, to mark those added or changed since the last save.
  const [stored] = useState(() => {
    const values = settingsValuesOf(program);
    return {
      keyDates: new Set(values.keyDates.map((value) => JSON.stringify(value))),
      events: new Set(values.events.map((value) => JSON.stringify(value))),
      titles: {
        opens: values.opensTitle,
        closes: values.closesTitle,
        outcomes: values.outcomesTitle,
      },
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
    if (failedWith(error, "PROGRAM_CHANGED_MEANWHILE")) {
      return { form: words(error), fields: {} };
    }
    if (isRefusal(code)) {
      const field = fieldOfCode[code];
      const message = words(error);
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
    const day = format.dateTime(starts, "date");
    if (allDay) {
      return day;
    }
    const time = (at: Date) => format.dateTime(at, "time");
    return endsAt ? `${day}, ${time(starts)}–${time(new Date(endsAt))}` : `${day}, ${time(starts)}`;
  }

  /** Saves Settings and answers the program as saved, or null when the form or the backend refused it. */
  async function save() {
    saved.current = null;
    await form.handleSubmit();
    return saved.current;
  }

  // A value changed and then put back is no change: there is nothing to save or to lose.
  const dirty = useStore(form.store, (formState) => !formState.isDefaultValue);
  const blocked = useStore(
    form.store,
    (formState) => missingToPublish(formState.values).length > 0,
  );

  const draft = program.status === "draft";
  // The moment the screen opened places the program in its dates. The program is read without an
  // "opened" fact or its phase, so both are worked out here from what it holds, as the backend does.
  const [now] = useState(() => Date.now());
  const standing = programStanding(program, now, partsInVietnam(new Date(now).toISOString()).day);
  const state = programState({ status: program.status, phase: standing.phase });
  // Once applications have opened, when they open is settled (PROGRAM_OPENING_FIXED), and a
  // published program keeps its cover (PROGRAM_PUBLISHED_INCOMPLETE): each is said at its field
  // instead of being refused on Save.
  const opened = program.applications ? Date.parse(program.applications.opensAt) <= now : false;
  const next = standing.next;
  const nextText =
    next === null
      ? null
      : "at" in next
        ? t(`phase.${next.kind}`, {
            when: `${format.dateTime(new Date(next.at), "day")}, ${format.dateTime(new Date(next.at), "time")}`,
          })
        : t(`phase.${next.kind}`, { day: format.dateTime(vietnamDay(next.day), "date") });

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-36 md:px-6 md:pb-12 lg:px-8"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        void form.handleSubmit();
      }}
    >
      <AdminPageHeader
        title={program.name}
        badges={
          <>
            <Badge variant={program.status === "published" ? "success" : state.variant}>
              {program.status === "published" ? t("published") : states("draft")}
            </Badge>
            {program.featuredAt && (
              <FeaturedBadge title={t("feature.hint")}>
                {t("feature.since", { day: format.dateTime(new Date(program.featuredAt), "date") })}
              </FeaturedBadge>
            )}
            {program.lumaEventId && (
              <Badge variant="outline">
                <RefreshCwIcon aria-hidden="true" />
                {t("luma.badge")}
              </Badge>
            )}
            {/* Published says only that the page is public: the phase and what comes next say where it stands. */}
            {!draft && (
              <span className="text-sm text-muted-foreground">
                {[states(standing.phase), nextText].filter(Boolean).join(" · ")}
              </span>
            )}
          </>
        }
        lead={
          dirty
            ? t("unsaved")
            : program.status === "published"
              ? t("context.published")
              : t("context.draft")
        }
        actions={
          <>
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
          </>
        }
      >
        {tabs}
      </AdminPageHeader>

      <form.AppForm>
        <form.FormError />
      </form.AppForm>

      {/* A program read from Luma is overwritten at the next read: say so before anyone edits it (BEY-190). */}
      {program.lumaEventId && (
        <Alert>
          <RefreshCwIcon aria-hidden="true" />
          <AlertTitle>{t("luma.title")}</AlertTitle>
          <AlertDescription>{t("luma.lead")}</AlertDescription>
          {program.externalUrl && (
            <AlertAction>
              <Button size="sm" prominence="secondary" href={program.externalUrl}>
                {t("luma.open")}
                <ArrowUpRightIcon aria-hidden="true" />
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}

      {draft && (
        <form.Subscribe selector={(formState) => missingToPublish(formState.values).join(" ")}>
          {(missing) =>
            (missing || program.publishIssues.length > 0) && (
              <PublishChecklist
                missing={missing ? (missing.split(" ") as typeof program.publishIssues) : []}
                fieldId={(field) => fieldIdOf(form, field)}
              />
            )
          }
        </form.Subscribe>
      )}

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
                  <FieldLabel htmlFor={fieldIds(field).control}>{t("basics.cover")}</FieldLabel>
                  <CoverUpload
                    id={fieldIds(field).control}
                    value={field.state.value}
                    onChange={field.handleChange}
                    invalid={errors.length > 0}
                    kept={draft ? undefined : t("cover.kept")}
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
            {(field) => <field.CheckboxField label={t("applications.takes")} disabled={opened} />}
          </form.AppField>
          <form.Subscribe selector={(formState) => formState.values.takesApplications}>
            {(takes) =>
              takes && (
                <>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                    <form.AppField name="opensDay">
                      {(field) => (
                        <field.TextField
                          label={t("applications.opens")}
                          type="date"
                          disabled={opened}
                          description={opened ? t("applications.opened") : undefined}
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="opensTime">
                      {(field) => (
                        <field.TextField
                          label={t("applications.time")}
                          type="time"
                          disabled={opened}
                        />
                      )}
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
              titles: {
                opens: formState.values.opensTitle,
                closes: formState.values.closesTitle,
                outcomes: formState.values.outcomesTitle,
              },
              takes: formState.values.takesApplications,
              opens: [formState.values.opensDay, formState.values.opensTime],
              closes: [formState.values.closesDay, formState.values.closesTime],
              outcomes: formState.values.outcomesDueOn,
            })}
          >
            {({ keyDates, titles, takes, opens, closes, outcomes }) => {
              // The window's dates belong in the timeline. Their day and time are edited under
              // Applications; their title is the operator's, or the words the page shows without one.
              const windowDate = (date: WindowDate, startsAt: string, allDay: boolean) => ({
                window: date,
                title: titles[date].trim() || timeline(date),
                startsAt,
                endsAt: null,
                allDay,
                index: null,
                note: t("keyDates.fromWindow"),
                unsaved: titles[date].trim() !== stored.titles[date],
              });
              const locked = takes
                ? [
                    opens[0] &&
                      opens[1] &&
                      windowDate("opens", instantInVietnam(opens[0], opens[1]), false),
                    closes[0] &&
                      closes[1] &&
                      windowDate("closes", instantInVietnam(closes[0], closes[1]), false),
                    outcomes && windowDate("outcomes", instantInVietnam(outcomes, "00:00"), true),
                  ].filter((entry) => !!entry)
                : [];
              const rows = [
                ...locked,
                ...keyDates.map((value, index) => ({
                  ...keyDateOf(value),
                  window: null,
                  index,
                  note: value.note || null,
                  unsaved: !stored.keyDates.has(JSON.stringify(value)),
                })),
              ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
              // Without a date there is no list, and so no rule under nothing.
              return (
                rows.length > 0 && (
                  <ul className="flex flex-col border-b">
                    {rows.map((row) => (
                      <li
                        key={row.window ? `window-${row.window}` : `date-${row.index}`}
                        className="flex items-center gap-3 border-t py-3"
                      >
                        <ScheduleEntry
                          when={when(row.startsAt, row.endsAt, row.allDay)}
                          title={row.title}
                          note={row.note}
                        />
                        {row.unsaved && <Badge variant="outline">{t("notSaved")}</Badge>}
                        {row.window ? (
                          <>
                            {/* The date is the window's and stays closed here; its title is not. */}
                            <LockIcon
                              role="img"
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-label={t("keyDates.locked")}
                            />
                            <Button
                              prominence="tertiary"
                              size="sm"
                              aria-label={t("windowTitle.renameNamed", { name: row.title })}
                              onClick={() => setRenaming(row.window)}
                            >
                              {t("windowTitle.rename")}
                            </Button>
                          </>
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
                )
              );
            }}
          </form.Subscribe>
          <form.Subscribe
            selector={(formState) => formState.values.keyDates.length >= maxScheduleEntries}
          >
            {(full) => (
              <div className="flex flex-col items-start gap-1">
                <Button
                  ref={addKeyDate}
                  prominence="tertiary"
                  size="sm"
                  disabled={full}
                  onClick={() => setKeyDate({ index: null })}
                >
                  <PlusIcon aria-hidden="true" />
                  {t("keyDates.add")}
                </Button>
                {full && (
                  <p className="text-sm text-muted-foreground">
                    {t("keyDates.full", { max: maxScheduleEntries })}
                  </p>
                )}
              </div>
            )}
          </form.Subscribe>
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
                        <ScheduleEntry
                          when={when(saved.startsAt, saved.endsAt, false)}
                          title={value.title}
                          note={where || null}
                        />
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
          <form.Subscribe
            selector={(formState) => formState.values.events.length >= maxScheduleEntries}
          >
            {(full) => (
              <div className="flex flex-col items-start gap-1">
                <Button
                  ref={addEvent}
                  prominence="tertiary"
                  size="sm"
                  disabled={full}
                  onClick={() => setEvent({ index: null })}
                >
                  <PlusIcon aria-hidden="true" />
                  {t("events.add")}
                </Button>
                {full && (
                  <p className="text-sm text-muted-foreground">
                    {t("events.full", { max: maxScheduleEntries })}
                  </p>
                )}
              </div>
            )}
          </form.Subscribe>
          <p className="text-sm text-muted-foreground">{t("applications.ict")}</p>
        </SettingsSection>
      </div>

      {/*
        The actions stay at the foot of the screen while the form scrolls: always below 768px, and
        from there up while there are unsaved changes, which the header's own actions scroll away from.
      */}
      <div
        // The page keeps what it scrolls into view above this bar (app/globals.css).
        data-slot="foot-bar"
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
                  className="inline-flex min-h-6 items-center self-start text-xs text-muted-foreground underline-offset-4 hover:underline md:self-auto"
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
          addButton={addKeyDate}
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
      {renaming && (
        <WindowTitleDialog
          value={form.getFieldValue(windowTitles[renaming])}
          defaultTitle={timeline(renaming)}
          onClose={() => setRenaming(null)}
          onSave={(title) => {
            form.setFieldValue(windowTitles[renaming], title);
            setRenaming(null);
          }}
        />
      )}
      {event && (
        <EventDialog
          value={event.index === null ? null : (form.getFieldValue("events")[event.index] ?? null)}
          onClose={() => setEvent(null)}
          addButton={addEvent}
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
