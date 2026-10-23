package ai.genaifund.beyondpilot.program.luma;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

import org.jspecify.annotations.Nullable;

/**
 * An event as a calendar file (RFC 5545) a confirmed guest adds to their calendar (BEY-245), with the venue or the
 * call Luma keeps for guests. Times are in UTC, which every calendar shows in its reader's own time.
 */
public final class EventCalendar {

	private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
		.withZone(ZoneOffset.UTC);

	/** The length of an event Luma gives no end for. */
	private static final Duration UNTIL = Duration.ofHours(1);

	/** The longest line in octets before it is folded. */
	private static final int LINE = 75;

	private EventCalendar() {
	}

	/**
	 * @param uid the same for every file of this guest and event, so adding it again updates the entry
	 * @param location the venue or the call's address; null when there is none
	 * @param page the event's page on the site
	 */
	public static String of(String uid, String name, Instant startsAt, @Nullable Instant endsAt,
			@Nullable String location, String page, Instant now) {
		StringBuilder file = new StringBuilder();
		line(file, "BEGIN:VCALENDAR");
		line(file, "VERSION:2.0");
		line(file, "PRODID:-//BeyondPilot//Events//EN");
		line(file, "CALSCALE:GREGORIAN");
		line(file, "METHOD:PUBLISH");
		line(file, "BEGIN:VEVENT");
		line(file, "UID:" + escape(uid));
		line(file, "DTSTAMP:" + UTC.format(now));
		line(file, "DTSTART:" + UTC.format(startsAt));
		line(file, "DTEND:" + UTC.format(endsAt == null ? startsAt.plus(UNTIL) : endsAt));
		line(file, "SUMMARY:" + escape(name));
		if (location != null) {
			line(file, "LOCATION:" + escape(location));
		}
		line(file, "DESCRIPTION:" + escape(page));
		line(file, "URL:" + page);
		line(file, "END:VEVENT");
		line(file, "END:VCALENDAR");
		return file.toString();
	}

	/** A value as the format reads it: a backslash, a semicolon, a comma and a line break escaped. */
	private static String escape(String value) {
		return value.replace("\\", "\\\\")
			.replace(";", "\\;")
			.replace(",", "\\,")
			.replace("\r\n", "\\n")
			.replace("\n", "\\n");
	}

	/** Writes the line folded at 75 octets, never inside a character, each part ended by CRLF. */
	private static void line(StringBuilder file, String content) {
		int octets = 0;
		for (int index = 0; index < content.length();) {
			int codePoint = content.codePointAt(index);
			int size = new String(Character.toChars(codePoint)).getBytes(StandardCharsets.UTF_8).length;
			if (octets + size > LINE) {
				file.append("\r\n ");
				octets = 1;
			}
			file.appendCodePoint(codePoint);
			octets += size;
			index += Character.charCount(codePoint);
		}
		file.append("\r\n");
	}

}
