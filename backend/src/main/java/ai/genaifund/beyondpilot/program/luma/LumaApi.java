package ai.genaifund.beyondpilot.program.luma;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
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

	/** The webhook events the calendar's read listens to. */
	public static final List<String> EVENT_TYPES = List.of("calendar.event.added", "event.created", "event.updated",
			"event.canceled");

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

	/** Removes the webhook; one Luma no longer has is already gone. */
	public void deleteWebhook(String key, String id) throws IOException {
		try {
			call(HttpMethod.POST, "/v1/webhooks/delete", Map.of(), key, Map.of("id", id));
		}
		catch (NotFound gone) {
			// Already removed on Luma.
		}
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
			Answer answer = request.exchange((asked, response) -> {
				try (InputStream stream = response.getBody()) {
					return new Answer(response.getStatusCode().value(), stream.readNBytes(MAX_BYTES + 1));
				}
			});
			if (answer.status() == 401 || answer.status() == 403) {
				throw new KeyRefused();
			}
			if (answer.status() == 404) {
				throw new NotFound();
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

	private record Answer(int status, byte[] body) {
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
