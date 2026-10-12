import { vietnamDay } from "@/features/program/program-format";
import { deadlineText, formatterOf } from "@/i18n/formats";

/** Times on the application form, in the app's shapes (`@/i18n/formats`), from the strings the backend sends. */
export function applyFormatter(locale: string) {
  const format = formatterOf(locale);
  return {
    /** "15 Oct, 23:59 ICT". */
    deadline: (at: string) => deadlineText(format, new Date(at)),
    /** "14:32". */
    time: (at: string) => format.dateTime(new Date(at), "time"),
    /** "16 Oct", a day the backend writes as 2026-10-16. */
    day: (day: string) => format.dateTime(vietnamDay(day), "day"),
    /** "3 Oct 2026, 14:32 ICT". */
    moment: (at: string) =>
      `${format.dateTime(new Date(at), "date")}, ${format.dateTime(new Date(at), "time")} ICT`,
  };
}
