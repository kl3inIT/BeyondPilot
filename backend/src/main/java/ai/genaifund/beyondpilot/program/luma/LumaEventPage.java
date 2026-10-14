package ai.genaifund.beyondpilot.program.luma;

import java.net.URI;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jspecify.annotations.Nullable;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.MissingNode;

/**
 * Reads what a Luma event is from its page: the schema.org {@code Event} the page carries as JSON-LD for search
 * engines, with the full description, the cover and the times with their offset, none of which the feed has.
 */
public final class LumaEventPage {

	private static final JsonMapper JSON = JsonMapper.builder().build();

	private LumaEventPage() {
	}

	/**
	 * The event as its page describes it.
	 * @param startsAt with the offset of where it is held, so its days are that place's
	 * @param city null when it is online or the page keeps its place for those who register
	 * @param image the address of its first image; null when it has none
	 */
	public record Event(String name, @Nullable String description, OffsetDateTime startsAt,
			@Nullable OffsetDateTime endsAt, boolean online, @Nullable String city, @Nullable String country,
			@Nullable URI image) {
	}

	/** The event of the page; empty when the page carries no {@code Event} with a name and a start. */
	public static Optional<Event> read(String html) {
		for (Element script : Jsoup.parse(html).select("script[type=application/ld+json]")) {
			try {
				Optional<Event> event = event(JSON.readTree(script.data()));
				if (event.isPresent()) {
					return event;
				}
			}
			catch (JacksonException notJson) {
				// Another block of the page; the event may be in the next.
			}
		}
		return Optional.empty();
	}

	private static Optional<Event> event(JsonNode node) {
		if (node.isArray()) {
			for (JsonNode item : node) {
				Optional<Event> event = event(item);
				if (event.isPresent()) {
					return event;
				}
			}
			return Optional.empty();
		}
		if (node.has("@graph")) {
			return event(node.get("@graph"));
		}
		String type = node.path("@type").asString("");
		if (!type.endsWith("Event")) {
			return Optional.empty();
		}
		String name = text(node.path("name"));
		OffsetDateTime startsAt = time(node.path("startDate"));
		if (name == null || startsAt == null) {
			return Optional.empty();
		}
		boolean online = node.path("eventAttendanceMode").asString("").endsWith("OnlineEventAttendanceMode");
		JsonNode place = place(node.path("location"));
		JsonNode address = place.path("address");
		JsonNode country = address.path("addressCountry");
		return Optional.of(new Event(name, text(node.path("description")), startsAt, time(node.path("endDate")), online,
				online ? null : text(address.path("addressLocality")),
				online ? null : country(text(country.isObject() ? country.path("name") : country)), image(node.path("image"))));
	}

	/** Luma names the country by its ISO code ("VN"); the program names it in words ("Vietnam"). */
	private static @Nullable String country(@Nullable String country) {
		if (country == null || country.length() != 2) {
			return country;
		}
		String name = Locale.of("", country.toUpperCase(Locale.ROOT)).getDisplayCountry(Locale.ENGLISH);
		return name.isEmpty() || name.equalsIgnoreCase(country) ? country : name;
	}

	/** The place it is held: the first location that is not online. */
	private static JsonNode place(JsonNode location) {
		if (location.isArray()) {
			for (JsonNode item : location) {
				if (!"VirtualLocation".equals(item.path("@type").asString(""))) {
					return item;
				}
			}
			return MissingNode.getInstance();
		}
		return location;
	}

	private static @Nullable URI image(JsonNode image) {
		JsonNode first = image.isArray() ? image.path(0) : image;
		String address = text(first.isObject() ? first.path("url") : first);
		if (address == null) {
			return null;
		}
		try {
			return URI.create(address);
		}
		catch (IllegalArgumentException notAddress) {
			return null;
		}
	}

	private static @Nullable OffsetDateTime time(JsonNode value) {
		String text = text(value);
		if (text == null) {
			return null;
		}
		try {
			return OffsetDateTime.parse(text);
		}
		catch (DateTimeParseException notTime) {
			return null;
		}
	}

	private static @Nullable String text(JsonNode value) {
		if (!value.isString()) {
			return null;
		}
		String text = value.asString().strip();
		return text.isEmpty() ? null : text;
	}

}
