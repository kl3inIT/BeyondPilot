package ai.genaifund.beyondpilot.identity.oauth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import ai.genaifund.beyondpilot.identity.oauth.ClientMetadataDocuments.ClientMetadata;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.json.JsonMapper;

/**
 * Which client ID metadata documents are fetched and what is kept of them: only addresses on a trusted host, only
 * redirects to a trusted host or this computer, and ChatGPT's signed requests; an address that could not be read is
 * not fetched again at once, and fetches are limited for each requester and for all of them together.
 */
class ClientMetadataDocumentsTest {

	private static final String CLAUDE = "https://claude.ai/oauth/mcp-oauth-client-metadata";

	private final JsonMapper json = JsonMapper.builder().build();

	private final ClientMetadataDocuments documents = new ClientMetadataDocuments(settings(10, 120), json);

	private static OAuthSettings settings(int perRequester, int perMinute) {
		return new OAuthSettings("https://beyondpilot.test", null, List.of("claude.ai", "chatgpt.com"),
				Duration.ofHours(1), Duration.ofDays(30), Duration.ofDays(180), perRequester, perMinute);
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
			Optional<ClientMetadata> read(String clientId) {
				calls.incrementAndGet();
				return Optional.empty();
			}
		};
	}

	@Test
	void oneRequesterSpendingItsShareDoesNotStopAnother() {
		AtomicInteger calls = new AtomicInteger();
		ClientMetadataDocuments limited = counting(settings(3, 120), calls);

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
	void anAddressThatCouldNotBeReadIsNotFetchedAgainAtOnce() {
		AtomicInteger calls = new AtomicInteger();
		ClientMetadataDocuments unreachable = counting(settings(10, 120), calls);

		for (int attempt = 0; attempt < 5; attempt++) {
			assertThat(unreachable.fetch("https://claude.ai/missing")).isEmpty();
		}

		assertThat(calls).hasValue(1);
	}

	@Test
	void theFetchesOfAllRequestersTogetherAreLimited() {
		AtomicInteger calls = new AtomicInteger();
		ClientMetadataDocuments limited = counting(settings(10, 3), calls);

		for (int requester = 0; requester < 10; requester++) {
			requestFrom("203.0.113." + requester);
			limited.fetch("https://claude.ai/client-" + requester);
		}

		assertThat(calls).hasValue(3);
	}

	@Test
	void onlyAPlainHttpsAddressOnATrustedHostIsFetched() {
		assertThat(documents.isDocumentAddress(CLAUDE)).isTrue();
		assertThat(documents.isDocumentAddress("https://CLAUDE.AI/client.json")).isTrue();
		assertThat(documents.isDocumentAddress("http://claude.ai/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://claude.ai.attacker.example/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://claude.ai:8443/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://user@claude.ai/client.json")).isFalse();
		assertThat(documents.isDocumentAddress("https://claude.ai/client.json?x=1")).isFalse();
		assertThat(documents.isDocumentAddress("cursor")).isFalse();
	}

	@Test
	void redirectsToAnotherHostAreDropped() {
		var metadata = documents.metadata(CLAUDE, json.readTree("""
				{"client_id": "%s", "client_name": "Claude",
				 "redirect_uris": ["https://claude.ai/api/mcp/auth_callback", "http://localhost/callback",
				                   "https://attacker.example/cb", "http://claude.ai/cb"]}
				""".formatted(CLAUDE)));

		assertThat(metadata).hasValueSatisfying(client -> {
			assertThat(client.name()).isEqualTo("Claude");
			assertThat(client.redirectUris())
				.containsExactly("https://claude.ai/api/mcp/auth_callback", "http://localhost/callback");
			assertThat(client.authenticationMethod()).isEqualTo("none");
		});
	}

	@Test
	void aDocumentThatNamesAnotherClientOrNoUsableRedirectIsRefused() {
		assertThat(documents.metadata(CLAUDE, json.readTree("""
				{"client_id": "https://claude.ai/other", "redirect_uris": ["https://claude.ai/cb"]}
				"""))).isEmpty();
		assertThat(documents.metadata(CLAUDE, json.readTree("""
				{"client_id": "%s", "redirect_uris": ["https://attacker.example/cb"]}
				""".formatted(CLAUDE)))).isEmpty();
	}

	@Test
	void chatGptSignsItsRequestsWithAKeyOnItsOwnHost() {
		String chatGpt = "https://chatgpt.com/oauth/client.json";
		var metadata = documents.metadata(chatGpt, json.readTree("""
				{"client_id": "%s", "redirect_uris": ["https://chatgpt.com/connector/oauth/cb"],
				 "token_endpoint_auth_method": "private_key_jwt", "jwks_uri": "https://chatgpt.com/oauth/jwks.json"}
				""".formatted(chatGpt)));

		assertThat(metadata).hasValueSatisfying(client -> {
			assertThat(client.name()).isEqualTo("chatgpt.com");
			assertThat(client.authenticationMethod()).isEqualTo("private_key_jwt");
			assertThat(client.jwksUri()).isEqualTo("https://chatgpt.com/oauth/jwks.json");
		});
	}

}
