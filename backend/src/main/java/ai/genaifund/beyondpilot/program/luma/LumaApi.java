package ai.genaifund.beyondpilot.program.luma;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The calls to Luma's public API with a calendar's key (BEY-245). Luma's text never leaves this class: a refusal is a
 * status, and an answer that is not what the API documents is an {@link IOException}.
 */
public final class LumaApi {

	/**
	 * The webhook events BeyondPilot listens to: a change of an event makes the calendar be read, and a change of a
	 * guest makes the guest be read.
	 */
	public static final List<String> EVENT_TYPES = List.of("calendar.event.added", "event.created", "event.updated",
			"event.canceled", "guest.registered", "guest.updated");

	private static final JsonMapper JSON = JsonMapper.builder().build();

	/** The most of one answer read; a page of fifty events is well under it. */
	private static final int MAX_BYTES = 4 * 1024 * 1024;

	private static final int PAGE = 50;

	private static final HttpClient CLIENT = HttpClient.newBuilder()
		.followRedirects(HttpClient.Redirect.NEVER)
		.connectTimeout(Duration.ofSeconds(5))
		.build();

	private final URI base;

	private final RestClient client;

	public LumaApi(URI base, Duration timeout) {
		this.base = base;
		JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(CLIENT);
		requests.setReadTimeout(timeout);
		this.client = RestClient.builder().requestFactory(requests).build();
	}

	/** Luma refused the key, or the key may not do what was asked. */
	public static final class KeyRefused extends IOException {

		private static final long serialVersionUID = 1L;

		KeyRefused() {
			super("Luma refused the key");
		}

	}

	/** Luma refused what was sent as not valid, as an answer to a question the event no longer asks. */
	public static final class Refused extends IOException {

		private static final long serialVersionUID = 1L;

		Refused() {
			super("Luma refused the request");
		}

	}

	/** A calendar the key belongs to. */
	public record Calendar(String id, String name) {
	}

	/**
	 * A webhook of the calendar.
	 * @param secret only when it was just made; Luma does not show it again
	 */
	public record Webhook(String id, String url, @Nullable String secret) {
	}

	/** @throws KeyRefused when Luma refuses the key */
	public Calendar calendar(String key) throws IOException {
		JsonNode calendar = unwrap(call(HttpMethod.GET, "/v1/calendars/get", Map.of(), key, null), "calendar");
		String id = text(calendar, "id");
		String name = text(calendar, "name");
		if (id == null || name == null) {
			throw new IOException("Luma answered no calendar");
		}
		return new Calendar(id, name);
	}

	/**
	 * Every event of the calendar, those it manages and those other hosts list on it, without their descriptions and
	 * hosts, which only {@link #event} gives.
	 */
	public List<LumaEvent> events(String key) throws IOException {
		List<LumaEvent> events = new ArrayList<>();
		for (String access : List.of("manage", "view")) {
			String cursor = null;
			do {
				Map<String, String> query = cursor == null ? Map.of("pagination_limit", String.valueOf(PAGE), "access", access)
						: Map.of("pagination_limit", String.valueOf(PAGE), "access", access, "pagination_cursor", cursor);
				JsonNode page = call(HttpMethod.GET, "/v1/calendars/events/list", query, key, null);
				for (JsonNode entry : page.path("entries")) {
					LumaEvent.of(unwrap(entry, "event")).ifPresent(events::add);
				}
				cursor = page.path("has_more").asBoolean(false) ? text(page, "next_cursor") : null;
			}
			while (cursor != null);
		}
		return events;
	}

	/** The event with its description and hosts; empty when Luma has no such event. */
	public Optional<LumaEvent> event(String key, String id) throws IOException {
		try {
			return LumaEvent.of(unwrap(call(HttpMethod.GET, "/v1/events/get", Map.of("event_id", id), key, null), "event"));
		}
		catch (NotFound gone) {
			return Optional.empty();
		}
	}

	public List<Webhook> webhooks(String key) throws IOException {
		List<Webhook> webhooks = new ArrayList<>();
		String cursor = null;
		do {
			Map<String, String> query = cursor == null ? Map.of() : Map.of("pagination_cursor", cursor);
			JsonNode page = call(HttpMethod.GET, "/v1/webhooks/list", query, key, null);
			for (JsonNode entry : page.path("entries")) {
				webhook(unwrap(entry, "webhook")).ifPresent(webhooks::add);
			}
			cursor = page.path("has_more").asBoolean(false) ? text(page, "next_cursor") : null;
		}
		while (cursor != null);
		return webhooks;
	}

	/** Makes a webhook that sends {@link #EVENT_TYPES} to the address; the answer carries its signing secret. */
	public Webhook createWebhook(String key, URI url) throws IOException {
		JsonNode made = unwrap(call(HttpMethod.POST, "/v2/webhooks/create", Map.of(), key,
				Map.of("url", url.toString(), "event_types", EVENT_TYPES)), "webhook");
		return webhook(made).filter(webhook -> webhook.secret() != null)
			.orElseThrow(() -> new IOException("Luma answered no webhook"));
	}

	/** Sets the events the webhook is sent for to {@link #EVENT_TYPES}, for one made before they grew. */
	public void updateWebhook(String key, String id) throws IOException {
		call(HttpMethod.POST, "/v2/webhooks/update", Map.of(), key, Map.of("id", id, "event_types", EVENT_TYPES));
	}

	/** Removes the webhook; one Luma no longer has is already gone. */
	public void deleteWebhook(String key, String id) throws IOException {
		try {
			call(HttpMethod.POST, "/v1/webhooks/delete", Map.of(), key, Map.of("id", id));
		}
		catch (NotFound gone) {
			// Already removed on Luma.
		}
	}

	/**
	 * One answer as Luma takes it: text for a text, a single select, an address, a phone number and a handle; the
	 * options for a multiple select; true or false for a box; {@code company} and {@code job_title} for a company.
	 */
	public record Answer(String questionId, Object value) {
	}

	/**
	 * Adds a person to the event with the status given and Luma's own email off. Luma does it in the background, and
	 * says only which addresses it skipped: one that unsubscribed from the calendar or was removed or blocked.
	 * @return true when Luma skipped the address and added no one
	 */
	public boolean addGuest(String key, String eventId, String email, String name, List<Answer> answers,
			LumaGuest.Status status) throws IOException {
		// In a fixed order, so what is sent reads the same each time.
		List<Map<String, Object>> sent = answers.stream().map(answer -> {
			Map<String, Object> one = new LinkedHashMap<>();
			one.put("question_id", answer.questionId());
			one.put("value", answer.value());
			return one;
		}).toList();
		Map<String, Object> guest = new LinkedHashMap<>();
		guest.put("email", email);
		guest.put("name", name);
		guest.put("registration_answers", sent);
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("event_id", eventId);
		body.put("guests", List.of(guest));
		body.put("approval_status", status.value());
		body.put("send_email", false);
		JsonNode added = call(HttpMethod.POST, "/v1/events/guests/add", Map.of(), key, body);
		return added.path("skipped").isArray() && !added.path("skipped").isEmpty();
	}

	/**
	 * An event to create on the calendar, free and kept private (BEY-250).
	 * @param venue a free-text address, or null for an event online or without a place yet
	 * @param capacity the seats, or null for no limit
	 */
	public record NewEvent(String name, Instant startsAt, @Nullable Instant endsAt, ZoneId zone, @Nullable String venue,
			boolean hideVenue, @Nullable String meetingUrl, @Nullable String description, boolean approval,
			@Nullable Integer capacity, boolean waitlist, List<NewQuestion> questions) {
	}

	/**
	 * A question of an event to create, in Luma's own types.
	 * @param id chosen by the caller, unique in the event
	 */
	public record NewQuestion(String id, String label, String type, boolean required, boolean multiline,
			List<String> options, boolean multiple) {
	}

	/**
	 * Creates a private event on the calendar with one free ticket, which asks for approval when the event does.
	 * @return the event's identifier
	 * @throws Refused when Luma refuses what was sent
	 */
	public String createEvent(String key, NewEvent event) throws IOException {
		// In a fixed order, so what is sent reads the same each time.
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("name", event.name());
		body.put("start_at", event.startsAt().toString());
		if (event.endsAt() != null) {
			body.put("end_at", event.endsAt().toString());
		}
		body.put("timezone", event.zone().getId());
		body.put("visibility", "private");
		if (event.description() != null) {
			body.put("description_md", event.description());
		}
		if (event.venue() != null) {
			Map<String, Object> place = new LinkedHashMap<>();
			place.put("type", "manual");
			place.put("address", event.venue());
			body.put("geo_address_json", place);
			body.put("location_visibility", event.hideVenue() ? "guests-only" : "public");
		}
		if (event.meetingUrl() != null) {
			body.put("meeting_url", event.meetingUrl());
		}
		if (event.capacity() != null) {
			body.put("max_capacity", event.capacity());
		}
		body.put("waitlist_status", event.waitlist() ? "enabled" : "disabled");
		Map<String, Object> ticket = new LinkedHashMap<>();
		ticket.put("name", "Standard");
		ticket.put("type", "free");
		ticket.put("require_approval", event.approval());
		body.put("ticket_types", List.of(ticket));
		body.put("registration_questions", event.questions().stream().map(LumaApi::question).toList());
		String id = text(call(HttpMethod.POST, "/v1/events/create", Map.of(), key, body), "id");
		if (id == null) {
			throw new IOException("Luma answered no event");
		}
		return id;
	}

	/**
	 * What to change of an event of the calendar; null leaves a field as it is.
	 * @param capacity the seats; 0 takes the limit away
	 * @param questions the whole form, replacing it; null keeps it
	 * @param emailGuests whether Luma emails the guests of a change of name, time or place
	 */
	public record EventChange(@Nullable String name, @Nullable Instant startsAt, @Nullable Instant endsAt,
			@Nullable ZoneId zone, @Nullable String venue, @Nullable Boolean hideVenue, @Nullable String meetingUrl,
			@Nullable String description, @Nullable Integer capacity, @Nullable Boolean waitlist,
			@Nullable List<NewQuestion> questions, LumaEvent.@Nullable Visibility visibility, @Nullable String coverUrl,
			boolean emailGuests) {
	}

	/**
	 * Changes an event of the calendar.
	 * @throws Refused when Luma refuses what was sent
	 */
	public void updateEvent(String key, String eventId, EventChange change) throws IOException {
		// In a fixed order, so what is sent reads the same each time.
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("event_id", eventId);
		if (change.name() != null) {
			body.put("name", change.name());
		}
		if (change.startsAt() != null) {
			body.put("start_at", change.startsAt().toString());
		}
		if (change.endsAt() != null) {
			body.put("end_at", change.endsAt().toString());
		}
		if (change.zone() != null) {
			body.put("timezone", change.zone().getId());
		}
		if (change.description() != null) {
			body.put("description_md", change.description());
		}
		if (change.venue() != null) {
			Map<String, Object> place = new LinkedHashMap<>();
			place.put("type", "manual");
			place.put("address", change.venue());
			body.put("geo_address_json", place);
		}
		if (change.hideVenue() != null) {
			body.put("location_visibility", change.hideVenue() ? "guests-only" : "public");
		}
		if (change.meetingUrl() != null) {
			body.put("meeting_url", change.meetingUrl());
		}
		if (change.capacity() != null) {
			// Luma takes null as no limit.
			body.put("max_capacity", change.capacity() == 0 ? null : change.capacity());
		}
		if (change.waitlist() != null) {
			body.put("waitlist_status", change.waitlist() ? "enabled" : "disabled");
		}
		if (change.questions() != null) {
			body.put("registration_questions", change.questions().stream().map(LumaApi::question).toList());
		}
		if (change.coverUrl() != null) {
			body.put("cover_url", change.coverUrl());
		}
		if (change.visibility() != null) {
			body.put("visibility", switch (change.visibility()) {
				case PUBLIC -> "public";
				case MEMBERS_ONLY -> "members-only";
				case PRIVATE -> "private";
			});
		}
		body.put("suppress_email", !change.emailGuests());
		call(HttpMethod.POST, "/v1/events/update", Map.of(), key, body);
	}

	private static Map<String, Object> question(NewQuestion question) {
		Map<String, Object> sent = new LinkedHashMap<>();
		sent.put("id", question.id());
		sent.put("label", question.label());
		sent.put("required", question.required());
		sent.put("question_type", question.type());
		if (question.multiline()) {
			sent.put("multiline", true);
		}
		if (!question.options().isEmpty()) {
			sent.put("options", question.options());
			sent.put("multiple", question.multiple());
		}
		if ("company".equals(question.type())) {
			sent.put("collect_job_title", true);
		}
		return sent;
	}

	/** The guest of the event with this address or identifier; empty while Luma has none. */
	public Optional<LumaGuest> guest(String key, String eventId, String emailOrId) throws IOException {
		try {
			return LumaGuest
				.of(unwrap(call(HttpMethod.GET, "/v1/events/guests/get", Map.of("event_id", eventId, "id", emailOrId),
						key, null), "guest"));
		}
		catch (NotFound none) {
			return Optional.empty();
		}
	}

	/** Every guest of the event, whatever their status. */
	public List<LumaGuest> guests(String key, String eventId) throws IOException {
		List<LumaGuest> guests = new ArrayList<>();
		String cursor = null;
		do {
			Map<String, String> query = cursor == null ? Map.of("event_id", eventId, "pagination_limit", String.valueOf(PAGE))
					: Map.of("event_id", eventId, "pagination_limit", String.valueOf(PAGE), "pagination_cursor", cursor);
			JsonNode page = call(HttpMethod.GET, "/v1/events/guests/list", query, key, null);
			for (JsonNode entry : page.path("entries")) {
				LumaGuest.of(unwrap(entry, "guest")).ifPresent(guests::add);
			}
			cursor = page.path("has_more").asBoolean(false) ? text(page, "next_cursor") : null;
		}
		while (cursor != null);
		return guests;
	}

	/**
	 * A guest of an event as an operator reads the guest list.
	 * @param answers each question's label and the answer as text, in the form's order
	 */
	public record GuestEntry(String id, @Nullable String email, @Nullable String name, String status,
			@Nullable Instant registeredAt, List<Answered> answers) {
	}

	/** A question and its answer, written out. */
	public record Answered(String label, String answer) {
	}

	/** Every guest of the event with what each answered, those with the status given only when one is. */
	public List<GuestEntry> guestEntries(String key, String eventId, LumaGuest.@Nullable Status status)
			throws IOException {
		List<GuestEntry> guests = new ArrayList<>();
		String cursor = null;
		do {
			Map<String, String> query = new LinkedHashMap<>();
			query.put("event_id", eventId);
			query.put("pagination_limit", String.valueOf(PAGE));
			if (status != null) {
				query.put("approval_status", status.value());
			}
			if (cursor != null) {
				query.put("pagination_cursor", cursor);
			}
			JsonNode page = call(HttpMethod.GET, "/v1/events/guests/list", query, key, null);
			for (JsonNode entry : page.path("entries")) {
				JsonNode guest = unwrap(entry, "guest");
				String id = text(guest, "id");
				String said = text(guest, "approval_status");
				if (id == null || said == null) {
					continue;
				}
				List<Answered> answers = new ArrayList<>();
				for (JsonNode answer : guest.path("registration_answers")) {
					String label = text(answer, "label");
					String written = answer(answer.path("value"));
					if (label != null && written != null) {
						answers.add(new Answered(label, written));
					}
				}
				String email = text(guest, "user_email");
				guests.add(new GuestEntry(id, email == null ? text(guest, "email") : email, text(guest, "user_name"),
						said, instant(text(guest, "registered_at")), answers));
			}
			cursor = page.path("has_more").asBoolean(false) ? text(page, "next_cursor") : null;
		}
		while (cursor != null);
		return guests;
	}

	/** An answer as text: a list joined, a company with the job title, a box as yes or no; null when empty. */
	private static @Nullable String answer(JsonNode value) {
		if (value.isBoolean()) {
			return value.asBoolean() ? "yes" : "no";
		}
		if (value.isArray()) {
			List<String> chosen = new ArrayList<>();
			value.forEach(item -> {
				if (item.isString() && !item.asString().isBlank()) {
					chosen.add(item.asString().strip());
				}
			});
			return chosen.isEmpty() ? null : String.join("; ", chosen);
		}
		if (value.isObject()) {
			String company = text(value, "company");
			String title = text(value, "job_title");
			return company == null ? title : title == null ? company : company + ", " + title;
		}
		if (value.isString() && !value.asString().isBlank()) {
			return value.asString().strip();
		}
		if (value.isNumber()) {
			return value.asString();
		}
		return null;
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

	/**
	 * Moves a guest of the event to the status, as an operator does on Luma.
	 * @param guestId the {@code gst-} identifier
	 * @param message a note Luma puts in its email to the guest; null for none
	 * @param sendEmail whether Luma emails the guest of it
	 * @throws Refused when Luma refuses the status
	 */
	public void updateGuestStatus(String key, String eventId, String guestId, LumaGuest.Status status,
			@Nullable String message, boolean sendEmail) throws IOException {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("event_id", eventId);
		body.put("guest_id", guestId);
		body.put("status", status.value());
		body.put("send_email", sendEmail);
		if (message != null) {
			body.put("message", message);
		}
		call(HttpMethod.POST, "/v1/events/guests/update-status", Map.of(), key, body);
	}

	/** An image of Luma's gallery of covers, which an event takes as its {@code cover_url} as it is. */
	public record CoverImage(String url, @Nullable String description) {
	}

	/** The first images of Luma's gallery of covers that match the words. */
	public List<CoverImage> covers(String key, String words, int limit) throws IOException {
		JsonNode page = call(HttpMethod.GET, "/v1/images/search",
				Map.of("query", words, "pagination_limit", String.valueOf(limit)), key, null);
		List<CoverImage> covers = new ArrayList<>();
		for (JsonNode entry : page.path("entries")) {
			String url = text(entry, "image_url");
			if (url != null && covers.size() < limit) {
				covers.add(new CoverImage(url, text(entry, "description")));
			}
		}
		return covers;
	}

	/** Makes every ticket type of the event ask for approval, or not; returns how many it has. */
	public int requireApproval(String key, String eventId, boolean approval) throws IOException {
		JsonNode types = call(HttpMethod.GET, "/v1/events/ticket-types/list",
				Map.of("event_id", eventId, "include_hidden", "true"), key, null);
		int count = 0;
		for (JsonNode entry : types.path("entries")) {
			String id = text(unwrap(entry, "ticket_type"), "id");
			if (id != null) {
				call(HttpMethod.POST, "/v1/events/ticket-types/update", Map.of(), key,
						Map.of("event_ticket_type_id", id, "require_approval", approval));
				count++;
			}
		}
		return count;
	}

	private static Optional<Webhook> webhook(JsonNode node) {
		String id = text(node, "id");
		String url = text(node, "url");
		return id == null || url == null ? Optional.empty() : Optional.of(new Webhook(id, url, text(node, "secret")));
	}

	/** Luma answered 404. */
	private static final class NotFound extends IOException {

		private static final long serialVersionUID = 1L;

		NotFound() {
			super("Luma has no such item");
		}

	}

	private JsonNode call(HttpMethod method, String path, Map<String, String> query, String key, @Nullable Object body)
			throws IOException {
		UriComponentsBuilder address = UriComponentsBuilder.fromUri(base).path(path);
		query.forEach(address::queryParam);
		try {
			RestClient.RequestBodySpec request = client.method(method)
				.uri(address.encode().build().toUri())
				.header("x-luma-api-key", key)
				.header("Accept", "application/json")
				.header("User-Agent", "BeyondPilot (+https://beyondpilot.ai)");
			if (body != null) {
				request.header("Content-Type", "application/json").body(JSON.writeValueAsString(body));
			}
			// Read here, whatever the status: the default handling would put Luma's text in an exception.
			Reply answer = request.exchange((asked, response) -> {
				try (InputStream stream = response.getBody()) {
					return new Reply(response.getStatusCode().value(), stream.readNBytes(MAX_BYTES + 1));
				}
			});
			if (answer.status() == 401 || answer.status() == 403) {
				throw new KeyRefused();
			}
			if (answer.status() == 404) {
				throw new NotFound();
			}
			if (answer.status() == 400 || answer.status() == 422) {
				throw new Refused();
			}
			if (answer.status() < 200 || answer.status() >= 300 || answer.body().length > MAX_BYTES) {
				throw new IOException("Luma answered " + answer.status());
			}
			String text = new String(answer.body(), StandardCharsets.UTF_8);
			return text.isBlank() ? JSON.createObjectNode() : JSON.readTree(text);
		}
		catch (RestClientException | IllegalArgumentException unreachable) {
			throw new IOException("Luma did not answer");
		}
		catch (JacksonException notJson) {
			throw new IOException("Luma answered something that is not JSON");
		}
	}

	private record Reply(int status, byte[] body) {
	}

	/** The object itself, or the one it wraps under the name, as some answers do. */
	private static JsonNode unwrap(JsonNode node, String name) {
		JsonNode inner = node.path(name);
		return inner.isObject() ? inner : node;
	}

	static @Nullable String text(JsonNode node, String field) {
		JsonNode value = node.path(field);
		if (!value.isString()) {
			return null;
		}
		String text = value.asString().strip();
		return text.isEmpty() ? null : text;
	}

}
