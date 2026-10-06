import { programFormatter } from "@/features/program/program-format";

/** Times on the application form, in Vietnam time, as the program sets its deadline. */
export function applyFormatter(locale: string) {
  const format = programFormatter(locale);
  const time = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
  return {
    /** "15 Oct, 23:59 ICT". */
    deadline: (at: string) =>
      `${format.dateTime(new Date(at), { day: "numeric", month: "short" })}, ${format.dateTime(new Date(at), time)} ICT`,
    /** "14:32". */
    time: (at: string) => format.dateTime(new Date(at), time),
    /** "16 Oct", a day the backend writes as 2026-10-16. */
    day: (day: string) =>
      format.dateTime(new Date(`${day}T00:00:00+07:00`), { day: "numeric", month: "short" }),
    /** "3 Oct 2026, 14:32 ICT". */
    moment: (at: string) =>
      `${format.dateTime(new Date(at), { day: "numeric", month: "short", year: "numeric" })}, ${format.dateTime(new Date(at), time)} ICT`,
  };
}
