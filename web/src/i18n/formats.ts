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

/** "15 Oct, 23:59 ICT": a moment the reader must know the zone of, such as a deadline. */
function deadlineText(format: Formatter, at: Date) {
  return `${format.dateTime(at, "day")}, ${format.dateTime(at, "time")} ICT`;
}

export { deadlineText, formats, formatterOf, timeZone, withAppDates, type Formatter };
