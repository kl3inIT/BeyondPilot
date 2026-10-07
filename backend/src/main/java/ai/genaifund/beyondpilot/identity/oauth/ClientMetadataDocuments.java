package ai.genaifund.beyondpilot.identity.oauth;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the client ID metadata document of an AI app (draft-ietf-oauth-client-id-metadata-document, preferred by MCP
 * 2026-07-28): the app's client ID is the HTTPS address of a JSON document naming it and its redirect addresses. Only
 * documents on a trusted host are fetched, so the server never requests an address an outsider chose; the fetch is
 * short, small and never follows a redirect. Anyone can send any address on those hosts, so an address that could not
 * be read is not fetched again for a few minutes, and fetches are limited per minute for each requester and for all of
 * them together: repeating or varying the address cannot make the server call out without end. A new app is first read
 * when a person's browser asks to connect it, from that person's own address, so an outsider spending their own share
 * does not stop it; an app read before keeps its stored document whenever a fetch is refused.
 */
@Component
class ClientMetadataDocuments {

	private static final Logger LOG = LoggerFactory.getLogger(ClientMetadataDocuments.class);

	/** A metadata document is a few hundred bytes; anything far larger is not one. */
	private static final int MAX_BYTES = 64 * 1024;

	/** How long an address that could not be read is refused without asking its host again. */
	private static final Duration UNREADABLE_FOR = Duration.ofMinutes(5);

	private final OAuthSettings settings;

	private final JsonMapper json;

	private final RestClient http;

	/** Addresses that could not be read lately; bounded, so varied addresses cannot fill the memory. */
	private final Cache<String, Boolean> unreadable = Caffeine.newBuilder()
		.maximumSize(10_000)
		.expireAfterWrite(UNREADABLE_FOR)
		.build();

	private final Bucket fetches;

	/** Each requester's share of the fetches; bounded and forgotten when idle. */
	private final Cache<String, Bucket> requesters = Caffeine.newBuilder()
		.maximumSize(10_000)
		.expireAfterAccess(Duration.ofMinutes(10))
		.build();

	ClientMetadataDocuments(OAuthSettings settings, JsonMapper json) {
		this.settings = settings;
		this.json = json;
		HttpClient client = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(5))
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(client);
		requests.setReadTimeout(Duration.ofSeconds(5));
		this.http = RestClient.builder().requestFactory(requests).build();
		this.fetches = perMinute(settings.documentFetchesPerMinute());
	}

	private static Bucket perMinute(int limit) {
		return Bucket.builder()
			.addLimit(Bandwidth.builder().capacity(limit).refillGreedy(limit, Duration.ofMinutes(1)).build())
			.build();
	}

	/**
	 * The address of the request being served, as the proxy reported it. Calls outside a request, which only tests
	 * make, share one share.
	 */
	private static String requester() {
		return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes current
				? current.getRequest().getRemoteAddr() : "none";
	}

	/** Whether this client ID is the address of a document BeyondPilot may fetch. */
	boolean isDocumentAddress(String clientId) {
		URI uri = uri(clientId);
		return uri != null && "https".equals(uri.getScheme()) && uri.getRawUserInfo() == null
				&& uri.getRawQuery() == null && uri.getRawFragment() == null && uri.getPort() == -1
				&& trusted(uri.getHost());
	}

	/**
	 * The app the document at this address describes, with only the redirect addresses BeyondPilot accepts: HTTPS on a
	 * trusted host, or this computer for an app that runs on it.
	 * @return empty when the address is not trusted, the document cannot be read, it names another client ID, or it
	 * leaves no accepted redirect address; also, without asking the host, when the address could not be read in the last
	 * few minutes or the fetches of the minute are spent
	 */
	Optional<ClientMetadata> fetch(String clientId) {
		if (!isDocumentAddress(clientId) || unreadable.getIfPresent(clientId) != null) {
			return Optional.empty();
		}
		Bucket share = requesters.get(requester(),
				address -> perMinute(settings.documentFetchesPerRequesterPerMinute()));
		if (!share.tryConsume(1) || !fetches.tryConsume(1)) {
			LOG.atWarn()
				.addKeyValue("event", "identity.oauth.client_document_fetches_limited")
				.log("Client ID metadata documents are being fetched too often; this one was not");
			return Optional.empty();
		}
		Optional<ClientMetadata> metadata = read(clientId);
		if (metadata.isEmpty()) {
			unreadable.put(clientId, Boolean.TRUE);
		}
		return metadata;
	}

	/** Fetches and reads the document; the one call that leaves the server. */
	Optional<ClientMetadata> read(String clientId) {
		try {
			JsonNode document = http.get().uri(URI.create(clientId)).exchange((request, response) -> {
				if (!response.getStatusCode().is2xxSuccessful()) {
					return null;
				}
				try (InputStream body = response.getBody()) {
					byte[] bytes = body.readNBytes(MAX_BYTES + 1);
					return bytes.length > MAX_BYTES ? null : json.readTree(bytes);
				}
			});
			return document == null ? Optional.empty() : metadata(clientId, document);
		}
		catch (RuntimeException failure) {
			LOG.atInfo()
				.addKeyValue("event", "identity.oauth.client_document_unreadable")
				.addKeyValue("error_type", failure.getClass().getName())
				.log("A client ID metadata document could not be read");
			return Optional.empty();
		}
	}

	/** What BeyondPilot keeps of the document at {@code clientId}, or empty when it does not describe a usable client. */
	Optional<ClientMetadata> metadata(String clientId, JsonNode document) {
		if (!clientId.equals(document.path("client_id").asString(""))) {
			return Optional.empty();
		}
		List<String> redirects = new ArrayList<>();
		for (JsonNode redirect : document.path("redirect_uris")) {
			String value = redirect.asString("");
			if (acceptedRedirect(value)) {
				redirects.add(value);
			}
		}
		if (redirects.isEmpty()) {
			return Optional.empty();
		}
		String name = document.path("client_name").asString("");
		String method = document.path("token_endpoint_auth_method").asString("none");
		String jwks = document.path("jwks_uri").asString("");
		return Optional.of(new ClientMetadata(clientId, name.isBlank() ? uri(clientId).getHost() : name.strip(),
				redirects, method, jwks.isBlank() || !isTrustedHttps(jwks) ? null : jwks));
	}

	private boolean acceptedRedirect(String value) {
		URI uri = uri(value);
		if (uri == null || uri.getRawFragment() != null || uri.getHost() == null) {
			return false;
		}
		if ("http".equals(uri.getScheme())) {
			return RedirectAddresses.isThisComputer(uri.getHost());
		}
		return "https".equals(uri.getScheme()) && trusted(uri.getHost());
	}

	private boolean isTrustedHttps(String value) {
		URI uri = uri(value);
		return uri != null && "https".equals(uri.getScheme()) && trusted(uri.getHost());
	}

	private boolean trusted(@Nullable String host) {
		if (host == null) {
			return false;
		}
		String lower = host.toLowerCase(Locale.ROOT);
		return settings.trustedClientHosts().stream().anyMatch(trusted -> lower.equals(trusted));
	}

	private static @Nullable URI uri(String value) {
		try {
			return new URI(value);
		}
		catch (URISyntaxException malformed) {
			return null;
		}
	}

	/**
	 * What BeyondPilot keeps of a document.
	 * @param authenticationMethod {@code none}, or {@code private_key_jwt} with {@code jwksUri}
	 */
	record ClientMetadata(String clientId, String name, List<String> redirectUris, String authenticationMethod,
			@Nullable String jwksUri) {
	}

}
