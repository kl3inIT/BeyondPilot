package ai.genaifund.beyondpilot.program.luma;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.Temporal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.Component;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.DateProperty;
import org.jspecify.annotations.Nullable;

/**
 * Reads a Luma calendar's iCal feed: which events it holds and where each one's page is. Luma writes every time in
 * UTC, names the event by a {@code UID} of {@code evt-…@events.lu.ma}, and puts the page's address in the description
 * ("Get up-to-date information at: https://luma.com/…").
 */
public final class LumaFeed {

	private static final Pattern PAGE = Pattern.compile("https?://[^\\s]+");

	private static final Pattern LINE_END = Pattern.compile("\r?\n");

	private LumaFeed() {
	}

	/**
	 * One event of the calendar.
	 * @param id Luma's identifier, {@code evt-…}
	 * @param page the address of its page
	 */
	public record Event(String id, Instant startsAt, @Nullable Instant endsAt, URI page) {

		/** Whether it is over at {@code now}. */
		public boolean over(Instant now) {
			return !(endsAt == null ? startsAt : endsAt).isAfter(now);
		}
	}

	/**
	 * The events of the feed; one without an identifier, a start or a page is left out.
	 * @throws IOException when the text is not a calendar
	 */
	public static List<Event> read(String text) throws IOException {
		Calendar calendar;
		try {
			// Luma ends its lines with a line feed alone, which ical4j does not unfold by default: a folded address would
			// lose its second half.
			calendar = new CalendarBuilder().build(new StringReader(LINE_END.matcher(text).replaceAll("\r\n")));
		}
		catch (ParserException | RuntimeException notCalendar) {
			throw new IOException("Not an iCal calendar");
		}
		List<Event> events = new ArrayList<>();
		for (VEvent event : calendar.<VEvent>getComponents(Component.VEVENT)) {
			Optional<String> uid = event.<Property>getProperty(Property.UID).map(Property::getValue);
			Instant startsAt = event.<DateProperty<?>>getProperty(Property.DTSTART).map(LumaFeed::instant).orElse(null);
			Instant endsAt = event.<DateProperty<?>>getProperty(Property.DTEND).map(LumaFeed::instant).orElse(null);
			URI page = event.<Property>getProperty(Property.DESCRIPTION)
				.map(found -> page(found.getValue()))
				.orElse(null);
			if (uid.isEmpty() || startsAt == null || page == null) {
				continue;
			}
			String id = uid.get().contains("@") ? uid.get().substring(0, uid.get().indexOf('@')) : uid.get();
			events.add(new Event(id, startsAt, endsAt, page));
		}
		return events;
	}

	private static @Nullable URI page(String description) {
		Matcher found = PAGE.matcher(description);
		if (!found.find()) {
			return null;
		}
		try {
			return URI.create(found.group());
		}
		catch (IllegalArgumentException notAddress) {
			return null;
		}
	}

	/** A time of the feed as an instant; one without a zone or a day alone is taken as UTC. */
	private static @Nullable Instant instant(DateProperty<?> property) {
		Temporal value = property.getDate();
		return switch (value) {
			case Instant instant -> instant;
			case ZonedDateTime zoned -> zoned.toInstant();
			case OffsetDateTime offset -> offset.toInstant();
			case LocalDateTime local -> local.toInstant(ZoneOffset.UTC);
			case LocalDate day -> day.atStartOfDay(ZoneOffset.UTC).toInstant();
			default -> null;
		};
	}

}
