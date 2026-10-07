import type { AdminProgram, ProgramEvent, ProgramKeyDate, SaveProgram } from "@/lib/api/generated";
import { instantInVietnam, partsInVietnam } from "@/lib/vietnam-time";

import type { EventValue, KeyDateValue, SettingsValues } from "./program-schemas";

/** An empty text as the backend wants it: absent. */
const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function keyDateValueOf(keyDate: ProgramKeyDate): KeyDateValue {
  const starts = partsInVietnam(keyDate.startsAt);
  return {
    title: keyDate.title,
    day: starts.day,
    from: keyDate.allDay ? "" : starts.time,
    to: keyDate.endsAt && !keyDate.allDay ? partsInVietnam(keyDate.endsAt).time : "",
    allDay: keyDate.allDay,
    note: keyDate.note ?? "",
  };
}

/** A key date of a whole day starts at midnight in Vietnam and has no end. */
export function keyDateOf(value: KeyDateValue): ProgramKeyDate {
  return {
    title: value.title.trim(),
    startsAt: instantInVietnam(value.day, value.allDay ? "00:00" : value.from),
    endsAt: !value.allDay && value.to ? instantInVietnam(value.day, value.to) : null,
    allDay: value.allDay,
    note: orNull(value.note),
  };
}

export function eventValueOf(event: ProgramEvent): EventValue {
  const starts = partsInVietnam(event.startsAt);
  const ends = event.endsAt ? partsInVietnam(event.endsAt) : { day: "", time: "" };
  return {
    title: event.title,
    startsDay: starts.day,
    startsTime: starts.time,
    endsDay: ends.day,
    endsTime: ends.time,
    online: event.online,
    city: event.city ?? "",
    country: event.country ?? "",
    registrationUrl: event.registrationUrl ?? "",
  };
}

export function eventOf(value: EventValue): ProgramEvent {
  return {
    title: value.title.trim(),
    startsAt: instantInVietnam(value.startsDay, value.startsTime),
    endsAt:
      value.endsDay && value.endsTime ? instantInVietnam(value.endsDay, value.endsTime) : null,
    online: value.online,
    // An online event has no place.
    city: value.online ? null : orNull(value.city),
    country: value.online ? null : orNull(value.country),
    registrationUrl: orNull(value.registrationUrl),
  };
}

/** A program as Settings holds it. */
export function settingsValuesOf(program: AdminProgram): SettingsValues {
  const applications = program.applications;
  const opens = applications ? partsInVietnam(applications.opensAt) : { day: "", time: "" };
  const closes = applications ? partsInVietnam(applications.closesAt) : { day: "", time: "" };
  return {
    version: program.version,
    name: program.name,
    slug: program.slug,
    type: program.type,
    partnerName: program.partnerName ?? "",
    summary: program.summary ?? "",
    about: program.about ?? "",
    startsOn: program.startsOn ?? "",
    endsOn: program.endsOn ?? "",
    pageKind: program.pageKind,
    externalUrl: program.externalUrl ?? "",
    coverFileId: program.coverFileId ?? "",
    takesApplications: Boolean(applications),
    opensDay: opens.day,
    opensTime: opens.time,
    closesDay: closes.day,
    closesTime: closes.time,
    shortlistSize: applications?.shortlistSize ? String(applications.shortlistSize) : "",
    outcomesDueOn: applications?.outcomesDueOn ?? "",
    allowUpdatesUntilClose: applications?.allowUpdatesUntilClose ?? true,
    keyDates: program.keyDates.map(keyDateValueOf),
    events: program.events.map(eventValueOf),
  };
}

/** What Settings sends: the whole program, the lists as they stand. */
export function saveBodyOf(values: SettingsValues): SaveProgram {
  return {
    version: values.version,
    name: values.name.trim(),
    slug: values.slug,
    type: values.type,
    partnerName: orNull(values.partnerName),
    summary: orNull(values.summary),
    about: orNull(values.about),
    startsOn: values.startsOn || null,
    endsOn: values.endsOn || null,
    pageKind: values.pageKind,
    externalUrl: orNull(values.externalUrl),
    coverFileId: values.coverFileId || null,
    applications: values.takesApplications
      ? {
          opensAt: instantInVietnam(values.opensDay, values.opensTime),
          closesAt: instantInVietnam(values.closesDay, values.closesTime),
          shortlistSize: values.shortlistSize ? Number(values.shortlistSize) : null,
          outcomesDueOn: values.outcomesDueOn || null,
          allowUpdatesUntilClose: values.allowUpdatesUntilClose,
        }
      : undefined,
    keyDates: values.keyDates.map(keyDateOf),
    events: values.events.map(eventOf),
  };
}

/** The settings field a refusal of the backend belongs beside, by its code or by the member it names. */
export const fieldOfCode: Partial<Record<string, keyof SettingsValues>> = {
  PROGRAM_SLUG_TAKEN: "slug",
  PROGRAM_SLUG_FIXED: "slug",
  PROGRAM_DAYS_OUT_OF_ORDER: "endsOn",
  PROGRAM_WINDOW_OUT_OF_ORDER: "closesDay",
  PROGRAM_OUTCOMES_BEFORE_CLOSE: "outcomesDueOn",
  PROGRAM_EXTERNAL_URL_REQUIRED: "externalUrl",
  PROGRAM_COVER_NOT_USABLE: "coverFileId",
  PROGRAM_OPENING_FIXED: "opensDay",
};

/** The settings field a member of the request is shown in. */
export function fieldOfMember(member: string): keyof SettingsValues | undefined {
  const byMember: Record<string, keyof SettingsValues> = {
    "applications.opensAt": "opensDay",
    "applications.closesAt": "closesDay",
    "applications.shortlistSize": "shortlistSize",
    "applications.outcomesDueOn": "outcomesDueOn",
  };
  if (byMember[member]) {
    return byMember[member];
  }
  const top = member.split(/[.[]/)[0];
  const fields: (keyof SettingsValues)[] = [
    "name",
    "slug",
    "type",
    "partnerName",
    "summary",
    "about",
    "startsOn",
    "endsOn",
    "pageKind",
    "externalUrl",
    "coverFileId",
  ];
  return fields.find((field) => field === top);
}
