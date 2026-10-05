/**
 * Programs are run from Vietnam: an operator enters a day and a time as they are in Vietnam (ICT,
 * UTC+7 all year, without daylight saving), whatever the zone of their computer. These turn what
 * the date and time inputs hold into the instants the backend stores, and back.
 */

const OFFSET = "+07:00";
const OFFSET_MS = 7 * 60 * 60 * 1000;

/** `2026-10-15` and `23:59` as the instant they are in Vietnam, in ISO 8601. */
export function instantInVietnam(day: string, time: string): string {
  return new Date(`${day}T${time}:00${OFFSET}`).toISOString();
}

/** An instant as the day (`2026-10-15`) and the time (`23:59`) it is in Vietnam. */
export function partsInVietnam(instant: string): { day: string; time: string } {
  const local = new Date(new Date(instant).getTime() + OFFSET_MS).toISOString();
  return { day: local.slice(0, 10), time: local.slice(11, 16) };
}
