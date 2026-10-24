/**
 * The event as a calendar file anyone can save from its page, before registering: its name, its
 * times and the place the page shows. A confirmed guest gets the file with the venue from the server.
 */
function calendarFile({
  name,
  startsAt,
  endsAt,
  place,
  slug,
}: {
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  place: string | null;
  slug: string;
}) {
  // An event with no end is taken to last an hour, as calendars show one.
  const end = endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BeyondPilot//Events//EN",
    "BEGIN:VEVENT",
    `UID:${slug}@beyondpilot.ai`,
    `DTSTAMP:${stamp(startsAt)}`,
    `DTSTART:${stamp(startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(name)}`,
    ...(place ? [`LOCATION:${text(place)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return {
    href: `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`,
    fileName: `${slug}.ics`,
  };
}

/** A moment in UTC as calendars write it: 20261119T100000Z. */
function stamp(moment: Date) {
  return moment
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Text as a calendar value holds it: a backslash, a comma, a semicolon and a line break escaped. */
function text(value: string) {
  return value.replace(/[\\,;]/g, (mark) => `\\${mark}`).replace(/\r?\n/g, "\\n");
}

export { calendarFile };
