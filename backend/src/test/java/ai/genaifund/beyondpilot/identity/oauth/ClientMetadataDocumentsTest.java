package ai.genaifund.beyondpilot.identity.oauth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * Which client ID metadata documents are fetched and what is kept of them: only addresses on a trusted host, only
 * redirects to a trusted host or this computer, and ChatGPT's signed requests.
 */
class ClientMetadataDocumentsTest {

	private static final String CLAUDE = "https://claude.ai/oauth/mcp-oauth-client-metadata";

	private final JsonMapper json = JsonMapper.builder().build();

	private final ClientMetadataDocuments documents = new ClientMetadataDocuments(
			new OAuthSettings("https://beyondpilot.test", null, List.of("claude.ai", "chatgpt.com"), Duration.ofHours(1),
					Duration.ofDays(30), Duration.ofDays(180)),
			json);

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
