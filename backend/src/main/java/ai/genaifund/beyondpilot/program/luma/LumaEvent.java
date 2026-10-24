package ai.genaifund.beyondpilot.program.luma;

import java.net.URI;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

/**
 * An event of the calendar as Luma's API gives it (BEY-245).
 * @param zone where it is held, so its days are that place's
 * @param description in Markdown, as the host wrote it, else the plain text; only {@link LumaApi#event} gives it
 * @param city null when it is online or Luma gives no city
 * @param country in English words ("Vietnam"); Luma gives an ISO code
 * @param cover the address of its cover image; null when it has none
 * @param page its page on Luma
 * @param listed true when the calendar only lists an event another host manages
 * @param form how people register for it on BeyondPilot; null when they register on Luma
 */
public record LumaEvent(String id, String name, @Nullable String description, Instant startsAt,
		@Nullable Instant endsAt, ZoneId zone, boolean online, @Nullable String city, @Nullable String country,
		@Nullable URI cover, URI page, Visibility visibility, boolean listed, @Nullable LumaForm form) {

	/** Who Luma shows the event to. */
	public enum Visibility {

		PUBLIC, MEMBERS_ONLY, PRIVATE;

		static Visibility of(@Nullable String code) {
			return switch (code == null ? "" : code) {
				case "public" -> PUBLIC;
				case "members-only" -> MEMBERS_ONLY;
				// Anything else is kept from the public, as Luma's own private events are.
				default -> PRIVATE;
			};
		}

	}

	/** Whether it has ended at the moment; an event without an end has ended once it started. */
	public boolean over(Instant now) {
		return !(endsAt == null ? startsAt : endsAt).isAfter(now);
	}

	/** The event of the node; empty when it lacks an identifier, a name, a start, a time zone or a page. */
	static Optional<LumaEvent> of(JsonNode node) {
		String id = LumaApi.text(node, "id");
		String name = LumaApi.text(node, "name");
		Instant startsAt = instant(LumaApi.text(node, "start_at"));
		ZoneId zone = zone(LumaApi.text(node, "timezone"));
		URI page = uri(LumaApi.text(node, "url"));
		if (id == null || name == null || startsAt == null || zone == null || page == null) {
			return Optional.empty();
		}
		Instant said = instant(LumaApi.text(node, "end_at"));
		Instant endsAt = said == null || said.isBefore(startsAt) ? null : said;
		// Luma names the kind of place: "offline" for a venue, "zoom", "google_meet"… for a call, "missing" for none.
		String kind = LumaApi.text(node, "location_type");
		boolean online = kind != null && !"offline".equals(kind) && !"missing".equals(kind);
		JsonNode address = node.path("geo_address_json");
		String markdown = LumaApi.text(node, "description_md");
		String description = markdown != null ? markdown : LumaApi.text(node, "description");
		return Optional.of(new LumaEvent(id, name, description, startsAt, endsAt, zone, online,
				online ? null : LumaApi.text(address, "city"), online ? null : country(LumaApi.text(address, "country")),
				uri(LumaApi.text(node, "cover_url")), page, Visibility.of(LumaApi.text(node, "visibility")),
				"view".equals(LumaApi.text(node, "access")), LumaForm.of(node, zone.getId()).orElse(null)));
	}

	/** Luma names the country by its ISO code ("VN"); the program names it in words ("Vietnam"). */
	private static @Nullable String country(@Nullable String country) {
		if (country == null || country.length() != 2) {
			return country;
		}
		String name = Locale.of("", country.toUpperCase(Locale.ROOT)).getDisplayCountry(Locale.ENGLISH);
		return name.isEmpty() || name.equalsIgnoreCase(country) ? country : name;
	}

	private static @Nullable Instant instant(@Nullable String text) {
		if (text == null) {
			return null;
		}
		try {
			return Instant.parse(text);
		}
		catch (DateTimeParseException notTime) {
			return null;
		}
	}

	private static @Nullable ZoneId zone(@Nullable String text) {
		if (text == null) {
			return null;
		}
		try {
			return ZoneId.of(text);
		}
		catch (DateTimeException notZone) {
			return null;
		}
	}

	private static @Nullable URI uri(@Nullable String text) {
		if (text == null) {
			return null;
		}
		try {
			URI address = URI.create(text);
			return "https".equalsIgnoreCase(address.getScheme()) || "http".equalsIgnoreCase(address.getScheme())
					? address : null;
		}
		catch (IllegalArgumentException notAddress) {
			return null;
		}
	}

}
