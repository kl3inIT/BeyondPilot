package ai.genaifund.beyondpilot.identity.oauth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import ai.genaifund.beyondpilot.identity.oauth.ClientMetadataDocuments.Fetched;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.json.JsonMapper;

/**
 * Which client ID metadata documents are fetched and what is kept of them: any host's, as an address nothing can read
 * two ways; redirects to the document's own host, this computer or the app's own scheme; keys on the document's own
 * host; kept as long as the document asks, within bounds; and fetches that cannot run without end.
 */
class ClientMetadataDocumentsTest {

	private static final String CLAUDE = "https://claude.ai/oauth/mcp-oauth-client-metadata";

	private final JsonMapper json = JsonMapper.builder().build();

	private final ClientMetadataDocuments documents = new ClientMetadataDocuments(settings(true, 10, 30, 120), json);

	private static OAuthSettings settings(boolean otherHosts, int perRequester, int perHost, int perMinute) {
		return new OAuthSettings("https://beyondpilot.test", null, List.of("claude.ai", "chatgpt.com"), otherHosts,
				Duration.ofHours(1), Duration.ofDays(30), Duration.ofDays(180), perRequester, perHost, perMinute);
	}

	@AfterEach
	void forgetRequest() {
		RequestContextHolder.resetRequestAttributes();
	}

	private static void requestFrom(String address) {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr(address);
		RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
	}

	private ClientMetadataDocuments counting(OAuthSettings settings, AtomicInteger calls) {
		return new ClientMetadataDocuments(settings, json) {
			@Override
			Optional<Fetched> read(String clientId) {
				calls.incrementAndGet();
				return Optional.empty();
			}
		};
	}

	@Test
	void anyHostsPlainHttpsAddressIsFetched() {
		assertThat(documents.isDocumentAddress(CLAUDE)).isTrue();
		assertThat(documents.isDocumentAddress("https://zed.dev/oauth/client-metadata.json")).isTrue();
		assertThat(documents.isDocumentAddress("https://ZED.dev:443/oauth/client.json")).isTrue();
	}

	@Test
	void anAddressThatCouldBeReadTwoWaysIsNotFetched() {
		assertThat(documents.isDocumentAddress("http://zed.dev/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev/")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev:8443/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://user@zed.dev/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev/client.json?x=1")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev/client.json#x")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev/a/../client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev/a/%2e%2e/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://127.0.0.1/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://[::1]/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://localhost/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://zed.dev/" + "a".repeat(2048))).isFalse();
		assertThat(documents.isDocumentAddress("cursor")).isFalse();
	}

	@Test
	void withOtherHostsOffOnlyReviewedHostsAreFetched() {
		ClientMetadataDocuments reviewedOnly = new ClientMetadataDocuments(settings(false, 10, 30, 120), json);

		assertThat(reviewedOnly.isDocumentAddress(CLAUDE)).isTrue();
		assertThat(reviewedOnly.isDocumentAddress("https://zed.dev/oauth/client-metadata.json")).isFalse();
		assertThat(reviewedOnly.isReviewed("CLAUDE.ai")).isTrue();
		assertThat(reviewedOnly.isReviewed("zed.dev")).isFalse();
	}

	@Test
	void redirectsKeptAreTheDocumentsHostThisComputerOrTheAppsOwnScheme() {
		var metadata = documents.metadata(CLAUDE, json.readTree("""
				{"client_id": "%s", "client_name": "Claude",
				 "redirect_uris": ["https://claude.ai/api/mcp/auth_callback", "http://localhost/callback",
				                   "http://[::1]/cb", "claude://auth/callback", "https://attacker.example/cb",
				                   "http://claude.ai/cb", "javascript://alert(1)", "data:text/html,x",
				                   "https://claude.ai/cb#x", "https://user@claude.ai/cb"]}
				""".formatted(CLAUDE)));

		assertThat(metadata).hasValueSatisfying(client -> {
			assertThat(client.name()).isEqualTo("Claude");
			assertThat(client.redirectUris()).containsExactly("https://claude.ai/api/mcp/auth_callback",
					"http://localhost/callback", "http://[::1]/cb", "claude://auth/callback");
			assertThat(client.authenticationMethod()).isEqualTo("none");
		});
	}

	@Test
	void aDocumentThatNamesAnotherClientNoUsableRedirectOrASecretIsRefused() {
		assertThat(documents.metadata(CLAUDE, json.readTree("""
				{"client_id": "https://claude.ai/other", "redirect_uris": ["https://claude.ai/cb"]}
				"""))).isEmpty();
		assertThat(documents.metadata(CLAUDE, json.readTree("""
				{"client_id": "%s", "redirect_uris": ["https://attacker.example/cb"]}
				""".formatted(CLAUDE)))).isEmpty();
		assertThat(documents.metadata(CLAUDE, json.readTree("""
				{"client_id": "%s", "redirect_uris": ["https://claude.ai/cb"], "token_endpoint_auth_method": "client_secret_basic"}
				""".formatted(CLAUDE)))).isEmpty();
	}

	@Test
	void chatGptSignsItsRequestsWithAKeyOnItsOwnHostOnly() {
		String chatGpt = "https://chatgpt.com/oauth/client.json";
		var metadata = documents.metadata(chatGpt, json.readTree("""
				{"client_id": "%s", "redirect_uris": ["https://chatgpt.com/connector_platform_oauth_redirect"],
				 "token_endpoint_auth_method": "private_key_jwt", "jwks_uri": "https://chatgpt.com/oauth/jwks.json"}
				""".formatted(chatGpt)));
		assertThat(metadata).hasValueSatisfying(client -> {
			assertThat(client.name()).isEqualTo("chatgpt.com");
			assertThat(client.jwksUri()).isEqualTo("https://chatgpt.com/oauth/jwks.json");
		});

		assertThat(documents.metadata(chatGpt, json.readTree("""
				{"client_id": "%s", "redirect_uris": ["https://chatgpt.com/cb"],
				 "token_endpoint_auth_method": "private_key_jwt", "jwks_uri": "https://attacker.example/jwks.json"}
				""".formatted(chatGpt)))).isEmpty();
	}

	@Test
	void aDocumentIsKeptAsLongAsItAsksWithinFiveMinutesAndADay() {
		assertThat(ClientMetadataDocuments.freshFor(new HttpHeaders())).isEqualTo(Duration.ofDays(1));
		assertThat(ClientMetadataDocuments.freshFor(headers("public, max-age=3600"))).isEqualTo(Duration.ofHours(1));
		assertThat(ClientMetadataDocuments.freshFor(headers("max-age=10"))).isEqualTo(Duration.ofMinutes(5));
		assertThat(ClientMetadataDocuments.freshFor(headers("max-age=31536000"))).isEqualTo(Duration.ofDays(1));
		assertThat(ClientMetadataDocuments.freshFor(headers("no-store"))).isEqualTo(Duration.ofMinutes(5));
	}

	private static HttpHeaders headers(String cacheControl) {
		HttpHeaders headers = new HttpHeaders();
		headers.setCacheControl(cacheControl);
		return headers;
	}

	@Test
	void anAddressThatCouldNotBeReadIsNotFetchedAgainAtOnce() {
		AtomicInteger calls = new AtomicInteger();
		ClientMetadataDocuments unreachable = counting(settings(true, 10, 30, 120), calls);

		for (int attempt = 0; attempt < 5; attempt++) {
			assertThat(unreachable.fetch("https://claude.ai/missing")).isEmpty();
		}

		assertThat(calls).hasValue(1);
	}

	@Test
	void oneRequesterSpendingItsShareDoesNotStopAnother() {
		AtomicInteger calls = new AtomicInteger();
		ClientMetadataDocuments limited = counting(settings(true, 3, 30, 120), calls);

		requestFrom("203.0.113.7");
		for (int address = 0; address < 10; address++) {
			limited.fetch("https://claude.ai/client-" + address);
		}
		assertThat(calls).hasValue(3);

		requestFrom("198.51.100.20");
		limited.fetch("https://chatgpt.com/oauth/client.json");
		assertThat(calls).hasValue(4);
	}

	@Test
	void oneHostsDocumentsCannotSpendEveryonesShare() {
		AtomicInteger calls = new AtomicInteger();
		ClientMetadataDocuments limited = counting(settings(true, 100, 3, 120), calls);

		for (int address = 0; address < 10; address++) {
			requestFrom("203.0.113." + address);
			limited.fetch("https://spam.example/client-" + address);
		}
		assertThat(calls).hasValue(3);

		limited.fetch("https://zed.dev/oauth/client-metadata.json");
		assertThat(calls).hasValue(4);
	}

	@Test
	void theFetchesOfAllRequestersTogetherAreLimited() {
		AtomicInteger calls = new AtomicInteger();
		ClientMetadataDocuments limited = counting(settings(true, 10, 30, 3), calls);

		for (int requester = 0; requester < 10; requester++) {
			requestFrom("203.0.113." + requester);
			limited.fetch("https://claude.ai/client-" + requester);
		}

		assertThat(calls).hasValue(3);
	}

}
