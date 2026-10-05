import type { getFormatter } from "next-intl/server";

import type { ProgramApplications, ProgramEvent, ProgramKeyDate } from "@/lib/api/generated";

type Format = Awaited<ReturnType<typeof getFormatter>>;

const time = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
const dayMonth = { day: "numeric", month: "short" } as const;

/**
 * The moment a page is rendered, which places each step of a timeline before or after it. A page is
 * rendered for each request, so it is the moment of the visit.
 */
export function renderedAt() {
  return Date.now();
}

/** A day the backend writes as `2026-12-05`, at midnight in Vietnam. */
export function vietnamDay(day: string) {
  return new Date(`${day}T00:00:00+07:00`);
}

/** "15 Oct, 23:59 ICT": a deadline as an applicant reads it. */
export function deadlineText(format: Format, applications: ProgramApplications) {
  const closes = new Date(applications.closesAt);
  return `${format.dateTime(closes, dayMonth)}, ${format.dateTime(closes, time)} ICT`;
}

/** "7 Oct, 15:30–17:00", "16 Oct": a key date or an event as a line of a timeline. */
export function whenText(
  format: Format,
  entry: Pick<ProgramKeyDate, "startsAt" | "endsAt"> & { allDay?: boolean },
) {
  const starts = new Date(entry.startsAt);
  const day = format.dateTime(starts, dayMonth);
  if (entry.allDay) {
    return day;
  }
  return entry.endsAt
    ? `${day}, ${format.dateTime(starts, time)}–${format.dateTime(new Date(entry.endsAt), time)}`
    : `${day}, ${format.dateTime(starts, time)}`;
}

/** "23 Sep – 5 Dec 2026", or one day. */
export function daysText(format: Format, startsOn: string, endsOn: string) {
  const options = { day: "numeric", month: "short", year: "numeric" } as const;
  return startsOn === endsOn
    ? format.dateTime(vietnamDay(startsOn), options)
    : format.dateTimeRange(vietnamDay(startsOn), vietnamDay(endsOn), options);
}

/** Where an event happens: online, or its city and country. */
export function placeOf(event: ProgramEvent, online: string) {
  return event.online ? online : [event.city, event.country].filter(Boolean).join(", ");
}
