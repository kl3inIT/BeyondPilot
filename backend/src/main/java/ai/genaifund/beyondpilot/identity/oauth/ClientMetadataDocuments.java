package ai.genaifund.beyondpilot.identity.oauth;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the client ID metadata document of an AI app (draft-ietf-oauth-client-id-metadata-document, preferred by MCP
 * 2026-07-28): the app's client ID is the HTTPS address of a JSON document naming it and its redirect addresses. Any
 * host may publish one, as the specification intends for an open server; which hosts may connect, and which are
 * reviewed, is the caller's to say (operators set it in Admin › AI › MCP). The fetch goes through {@link OutsideHttp}: public addresses only, no redirect, five seconds, five kilobytes.
 * <p>
 * Anyone can send any address, so the server never calls out without end: an address that could not be read is not
 * fetched again for a few minutes; fetches are limited per minute for each requester (an IPv6 requester by its /64,
 * which one person holds whole), each document host and all of them together; and requests for one address at once
 * share one fetch. A new app is first read when a person's browser asks to connect it, from that person's own address,
 * so an outsider spending their own share does not stop it. An outsider cannot spend a reviewed host's share, which has
 * none, nor stop an app read before from being read again, which spends no host's or common share and keeps its stored
 * document whenever a fetch is refused.
 */
@Component
class ClientMetadataDocuments {

	private static final Logger LOG = LoggerFactory.getLogger(ClientMetadataDocuments.class);

	/** A metadata document is a few hundred bytes; implementations of the draft refuse past five kilobytes. */
	private static final int MAX_BYTES = 5 * 1024;

	private static final int MAX_ADDRESS = 2048;

	/** How long an address that could not be read is refused without asking its host again. */
	private static final Duration UNREADABLE_FOR = Duration.ofMinutes(5);

	/** How long a document is kept before it is read again, within what its {@code Cache-Control} asks. */
	static final Duration FRESH_AT_LEAST = Duration.ofMinutes(5);

	static final Duration FRESH_AT_MOST = Duration.ofDays(1);

	private static final Pattern MAX_AGE = Pattern.compile("max-age=(\\d+)");

	private static final Pattern SCHEME = Pattern.compile("[a-z][a-z0-9+.-]*");

	/** Schemes a redirect may never use: they run code, read files, or are the web's own handled elsewhere. */
	private static final Set<String> FORBIDDEN_SCHEMES = Set.of("javascript", "data", "file", "vbscript", "about", "blob",
			"ftp", "ws", "wss");

	private final OAuthSettings settings;

	private final JsonMapper json;

	private final RestClient http = OutsideHttp.client(MAX_BYTES);

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

	/** Each document host's share, so many addresses on one host cannot spend everyone's. */
	private final Cache<String, Bucket> hosts = Caffeine.newBuilder()
		.maximumSize(10_000)
		.expireAfterAccess(Duration.ofMinutes(10))
		.build();

	/** The fetches under way, so requests for one address at once share one. */
	private final Map<String, CompletableFuture<Optional<Fetched>>> underway = new ConcurrentHashMap<>();

	ClientMetadataDocuments(OAuthSettings settings, JsonMapper json) {
		this.settings = settings;
		this.json = json;
		this.fetches = perMinute(settings.documentFetchesPerMinute());
	}

	private static Bucket perMinute(int limit) {
		return Bucket.builder()
			.addLimit(Bandwidth.builder().capacity(limit).refillGreedy(limit, Duration.ofMinutes(1)).build())
			.build();
	}

	/**
	 * The address of the request being served, as the proxy reported it; the edge proxy replaces
	 * {@code X-Forwarded-For} rather than appending to it and drops {@code Forwarded}, so a client cannot choose it
	 * (docs/runbooks/ci-cd.md › The reverse proxy). Calls outside a request, which only tests make, share one share.
	 */
	private static String requester() {
		String address = RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes current
				? current.getRequest().getRemoteAddr() : "none";
		try {
			if (address.contains(":") && InetAddress.getByName(address) instanceof Inet6Address v6) {
				byte[] prefix = Arrays.copyOf(v6.getAddress(), 8);
				return "v6:" + HexFormat.of().formatHex(prefix);
			}
		}
		catch (UnknownHostException notAnAddress) {
			return address;
		}
		return address;
	}

	/**
	 * Whether this client ID is the address of a document BeyondPilot may fetch: HTTPS on the default port, a host
	 * name rather than an address, a path, and nothing a parser could read two ways (credentials, a query, a fragment,
	 * dot segments).
	 */
	boolean isDocumentAddress(String clientId) {
		String lower = clientId.toLowerCase(Locale.ROOT);
		if (clientId.length() > MAX_ADDRESS || lower.contains("/./") || lower.contains("/../") || lower.endsWith("/.")
				|| lower.endsWith("/..") || lower.contains("%2e") || lower.contains("\\")) {
			return false;
		}
		URI uri = uri(clientId);
		if (uri == null || !"https".equals(uri.getScheme()) || uri.getRawUserInfo() != null || uri.getRawQuery() != null
				|| uri.getRawFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
			return false;
		}
		String host = uri.getHost();
		String path = uri.getRawPath();
		return host != null && isName(host) && path != null && path.length() > 1;
	}

	/** The host of a document address, in lower case. */
	static String hostOf(String clientId) {
		return URI.create(clientId).getHost().toLowerCase(Locale.ROOT);
	}

	/**
	 * The app the document at this address describes, and how long to keep it.
	 * @param stored whether this app was read before, so this is a read again that spends no host's or common share
	 * @param reviewed whether its host is reviewed, whose share an outsider cannot spend
	 * @return empty when the address may not be fetched, the document cannot be read or does not describe a usable
	 * client; also, without asking the host, when the address could not be read in the last few minutes or a share of
	 * the minute's fetches is spent
	 */
	Optional<Fetched> fetch(String clientId, boolean stored, boolean reviewed) {
		if (!isDocumentAddress(clientId) || unreadable.getIfPresent(clientId) != null) {
			return Optional.empty();
		}
		CompletableFuture<Optional<Fetched>> mine = new CompletableFuture<>();
		CompletableFuture<Optional<Fetched>> running = underway.putIfAbsent(clientId, mine);
		if (running != null) {
			return running.join();
		}
		try {
			Optional<Fetched> fetched = limitedRead(clientId, stored, reviewed);
			mine.complete(fetched);
			return fetched;
		}
		catch (RuntimeException failure) {
			mine.complete(Optional.empty());
			throw failure;
		}
		finally {
			underway.remove(clientId, mine);
		}
	}

	private Optional<Fetched> limitedRead(String clientId, boolean stored, boolean reviewed) {
		String host = URI.create(clientId).getHost().toLowerCase(Locale.ROOT);
		Bucket requester = requesters.get(requester(), key -> perMinute(settings.documentFetchesPerRequesterPerMinute()));
		boolean allowed = requester.tryConsume(1);
		if (allowed && !stored) {
			allowed = (reviewed
					|| hosts.get(host, key -> perMinute(settings.documentFetchesPerHostPerMinute())).tryConsume(1))
					&& fetches.tryConsume(1);
		}
		if (!allowed) {
			LOG.atWarn()
				.addKeyValue("event", "identity.oauth.client_document_fetches_limited")
				.log("Client ID metadata documents are being fetched too often; this one was not");
			return Optional.empty();
		}
		Optional<Fetched> fetched = read(clientId);
		if (fetched.isEmpty()) {
			unreadable.put(clientId, Boolean.TRUE);
		}
		return fetched;
	}

	/** Fetches and reads the document; the one call that leaves the server. */
	Optional<Fetched> read(String clientId) {
		try {
			return http.get().uri(URI.create(clientId)).exchange((request, response) -> {
				if (response.getStatusCode().value() != 200) {
					return Optional.empty();
				}
				JsonNode document = json.readTree(response.getBody());
				return metadata(clientId, document)
					.map(metadata -> new Fetched(metadata, freshFor(response.getHeaders())));
			});
		}
		catch (RuntimeException failure) {
			LOG.atInfo()
				.addKeyValue("event", "identity.oauth.client_document_unreadable")
				.addKeyValue("error_type", failure.getClass().getName())
				.log("A client ID metadata document could not be read");
			return Optional.empty();
		}
	}

	/** What the document's {@code Cache-Control} asks, kept between five minutes and a day; a day when it asks nothing. */
	static Duration freshFor(HttpHeaders headers) {
		String control = headers.getCacheControl();
		if (control == null) {
			return FRESH_AT_MOST;
		}
		String lower = control.toLowerCase(Locale.ROOT);
		if (lower.contains("no-store") || lower.contains("no-cache")) {
			return FRESH_AT_LEAST;
		}
		Matcher age = MAX_AGE.matcher(lower);
		if (!age.find()) {
			return FRESH_AT_MOST;
		}
		Duration asked;
		try {
			asked = Duration.ofSeconds(Long.parseLong(age.group(1)));
		}
		catch (NumberFormatException tooLong) {
			return FRESH_AT_MOST;
		}
		return asked.compareTo(FRESH_AT_LEAST) < 0 ? FRESH_AT_LEAST
				: asked.compareTo(FRESH_AT_MOST) > 0 ? FRESH_AT_MOST : asked;
	}

	/**
	 * What BeyondPilot keeps of the document at {@code clientId}, or empty when it does not describe a usable client:
	 * it must name its own address, keep at least one accepted redirect, and authenticate with nothing or with a key
	 * published on its own host. Accepted redirects: HTTPS on the document's host, this computer on any port, or an
	 * app's own scheme named after the reverse of the document's host, such as {@code dev.zed://} for a document on
	 * {@code zed.dev}. Unknown fields are ignored, so a document cannot set anything else.
	 */
	Optional<ClientMetadata> metadata(String clientId, JsonNode document) {
		if (!clientId.equals(document.path("client_id").asString(""))) {
			return Optional.empty();
		}
		String host = URI.create(clientId).getHost();
		List<String> redirects = new ArrayList<>();
		for (JsonNode redirect : document.path("redirect_uris")) {
			String value = redirect.asString("");
			if (acceptedRedirect(value, host)) {
				redirects.add(value);
			}
		}
		if (redirects.isEmpty()) {
			return Optional.empty();
		}
		String method = document.path("token_endpoint_auth_method").asString("none");
		String keys = document.path("jwks_uri").asString("");
		if (!method.equals("none") && !(method.equals("private_key_jwt") && sameHttpsHost(keys, host))) {
			return Optional.empty();
		}
		String name = document.path("client_name").asString("").strip();
		if (name.isEmpty()) {
			name = host;
		}
		return Optional.of(new ClientMetadata(clientId, name.length() > 100 ? name.substring(0, 100) : name, redirects,
				method, method.equals("private_key_jwt") ? keys : null));
	}

	private static boolean acceptedRedirect(String value, String host) {
		URI uri = uri(value);
		if (uri == null || uri.getScheme() == null || uri.getRawFragment() != null || uri.getRawUserInfo() != null) {
			return false;
		}
		String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
		return switch (scheme) {
			case "https" -> host.equalsIgnoreCase(uri.getHost());
			case "http" -> RedirectAddresses.isThisComputer(uri.getHost());
			// An app's own scheme is named after the reverse of a domain it holds (RFC 8252 §7.1), here the document's:
			// any other could open another app, a browser among them, that sends the code elsewhere.
			default -> SCHEME.matcher(scheme).matches() && !FORBIDDEN_SCHEMES.contains(scheme)
					&& (scheme.equals(reversed(host)) || scheme.startsWith(reversed(host) + "."));
		};
	}

	private static String reversed(String host) {
		List<String> labels = new ArrayList<>(List.of(host.toLowerCase(Locale.ROOT).split("\\.")));
		Collections.reverse(labels);
		return String.join(".", labels);
	}

	private static boolean sameHttpsHost(String value, String host) {
		URI uri = uri(value);
		return uri != null && "https".equals(uri.getScheme()) && host.equalsIgnoreCase(uri.getHost())
				&& uri.getRawUserInfo() == null;
	}

	/** A host name, not an address written out: documents live on named hosts. */
	private static boolean isName(String host) {
		return !host.startsWith("[") && !host.matches("[0-9.]+") && host.contains(".");
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

	/** A document read, and how long to keep it before reading it again. */
	record Fetched(ClientMetadata metadata, Duration freshFor) {
	}

}
