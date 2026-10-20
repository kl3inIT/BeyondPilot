import { createFormatter, type Formats } from "next-intl";

/** Deadlines and schedules are defined in Vietnam time (ICT), whoever is reading. */
const timeZone = "Asia/Ho_Chi_Minh";

/**
 * The few shapes a date takes in the app, by name: `format.dateTime(at, "date")`. A date is written as
 * GenAI Fund writes it, day before month, and a time on the 24-hour clock.
 */
const formats = {
  dateTime: {
    /** "15 Oct": a day of the year in view. */
    day: { day: "numeric", month: "short" },
    /** "15 Oct 2026": a day, wherever the year is not plain. */
    date: { day: "numeric", month: "short", year: "numeric" },
    /** "23:59". */
    time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    /** "23:59:07": a time to the second, where events follow one another closely. */
    seconds: { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" },
  },
} as const satisfies Formats;

/**
 * The locale dates are written in. English follows the British order ("15 Oct 2026"): the American
 * one ("Oct 15, 2026") is never how GenAI Fund writes a date.
 */
function dateLocale(locale: string) {
  return locale === "en" ? "en-GB" : locale;
}

type Formatter = ReturnType<typeof createFormatter>;

/**
 * The formatter of a locale with its dates written the app's way; numbers, lists and relative times
 * stay those of `base`. The formatters of `./format` and `./format-server` are this one.
 */
function withAppDates(base: Formatter, locale: string): Formatter {
  const dates = createFormatter({ locale: dateLocale(locale), timeZone, formats });
  return { ...base, dateTime: dates.dateTime, dateTimeRange: dates.dateTimeRange };
}

/** The app's formatter for a locale, where no component is at hand to give next-intl's. */
function formatterOf(locale: string): Formatter {
  return withAppDates(createFormatter({ locale, timeZone, formats }), locale);
}

/**
 * The app writes every time of day with its zone: the times are Vietnam's, whoever reads them, and
 * a reader elsewhere must not take them for their own. Intl names the zone "GMT+7" or "Indochina
 * Time", never "ICT" as GenAI Fund writes it, so the name is added here. The day comes first and the
 * time after it in every locale; Intl's own joined form puts the time first in Vietnamese.
 */
type Clock = "time" | "seconds";

/** "23:59 ICT", or "23:59:07 ICT" with `"seconds"`. */
function clockText(format: Formatter, at: Date, clock: Clock = "time") {
  return `${format.dateTime(at, clock)} ICT`;
}

/**
 * "15 Oct 2026, 23:59 ICT", or "15 Oct, 23:59 ICT" with `"day"`; with `until`, a span within the day:
 * "7 Oct, 15:30–17:00 ICT".
 */
function momentText(
  format: Formatter,
  at: Date,
  day: "day" | "date" = "date",
  { until, clock = "time" }: { until?: Date; clock?: Clock } = {},
) {
  const time = until
    ? `${format.dateTime(at, clock)}–${format.dateTime(until, clock)}`
    : format.dateTime(at, clock);
  return `${format.dateTime(at, day)}, ${time} ICT`;
}

/** "15 Oct, 23:59 ICT": a deadline, in the year in view. */
function deadlineText(format: Formatter, at: Date) {
  return momentText(format, at, "day");
}

export {
  clockText,
  deadlineText,
  formats,
  formatterOf,
  momentText,
  timeZone,
  withAppDates,
  type Formatter,
};
