package ai.genaifund.beyondpilot.identity.oauth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.server.authorization.client.JdbcRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.OAuth2TokenFormat;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Component;

/**
 * The AI apps that may sign in. An app with a client ID metadata document is read the first time and stored, so a later
 * lookup by Spring's own identifier still finds it, and read again once the time its document asked for has passed.
 * Two clients are BeyondPilot's own: Cursor's, which has no document yet, and one for any agent on a person's computer
 * that has none either. There is no dynamic registration, which MCP 2026-07-28 deprecates.
 */
@Component
class McpClients implements RegisteredClientRepository {

	/** Cursor's client, which a person puts in Cursor's {@code mcp.json}. */
	static final String CURSOR = "cursor";

	/**
	 * The client of any agent on a person's computer without a document of its own, such as Gemini CLI or Cline. It
	 * redirects only to this computer, so a code it asks for can reach nothing else.
	 */
	static final String LOCAL = "mcp-local";

	/** When a stored document should be read again, kept with the client. */
	private static final String FRESH_UNTIL = "beyondpilot.document-fresh-until";

	private final JdbcRegisteredClientRepository stored;

	private final ClientMetadataDocuments documents;

	private final OAuthSettings settings;

	McpClients(JdbcOperations jdbc, ClientMetadataDocuments documents, OAuthSettings settings) {
		this.stored = new JdbcRegisteredClientRepository(jdbc);
		this.documents = documents;
		this.settings = settings;
	}

	@Override
	public void save(RegisteredClient client) {
		stored.save(client);
	}

	@Override
	public @Nullable RegisteredClient findById(String id) {
		return stored.findById(id);
	}

	@Override
	public @Nullable RegisteredClient findByClientId(String clientId) {
		RegisteredClient known = stored.findByClientId(clientId);
		if (!documents.isDocumentAddress(clientId)) {
			// An app whose host is no longer allowed loses its stored document with it.
			return known == null || isOwn(known) ? known : null;
		}
		if (known != null && Instant.now().isBefore(freshUntil(known))) {
			return known;
		}
		// A document that cannot be read now keeps the version stored, so a short outage of the app's host signs
		// nobody out; one never read is refused.
		return documents.fetch(clientId, known != null).map(fetched -> {
			RegisteredClient client = fromDocument(fetched);
			stored.save(client);
			return client;
		}).orElse(known);
	}

	/** Registers BeyondPilot's own clients, or brings them up to date. */
	void registerOwn() {
		stored.save(base(idOf(CURSOR), CURSOR, "Cursor")
			.clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
			.redirectUris(uris -> uris.addAll(List.of("http://localhost:8787/callback",
					"https://www.cursor.com/agents/mcp/oauth/callback", "cursor://anysphere.cursor-mcp/oauth/callback")))
			.clientSettings(ClientSettings.builder().requireProofKey(true).requireAuthorizationConsent(true).build())
			.build());
		// Any path and port on this computer is accepted for this client (RedirectAddresses); one is listed because
		// Spring needs one.
		stored.save(base(idOf(LOCAL), LOCAL, "An app on this computer")
			.clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
			.redirectUri("http://127.0.0.1/callback")
			.clientSettings(ClientSettings.builder().requireProofKey(true).requireAuthorizationConsent(true).build())
			.build());
	}

	private static boolean isOwn(RegisteredClient client) {
		return client.getClientId().equals(CURSOR) || client.getClientId().equals(LOCAL);
	}

	private static Instant freshUntil(RegisteredClient client) {
		Object until = client.getClientSettings().getSetting(FRESH_UNTIL);
		try {
			return until instanceof String value ? Instant.parse(value) : Instant.EPOCH;
		}
		catch (DateTimeParseException malformed) {
			return Instant.EPOCH;
		}
	}

	private RegisteredClient fromDocument(ClientMetadataDocuments.Fetched fetched) {
		ClientMetadataDocuments.ClientMetadata metadata = fetched.metadata();
		RegisteredClient.Builder builder = base(idOf(metadata.clientId()), metadata.clientId(), metadata.name())
			.redirectUris(uris -> uris.addAll(metadata.redirectUris()));
		ClientSettings.Builder client = ClientSettings.builder()
			.requireProofKey(true)
			.requireAuthorizationConsent(true)
			.setting(FRESH_UNTIL, Instant.now().plus(fetched.freshFor()).toString());
		if (metadata.jwksUri() != null) {
			// ChatGPT signs its token requests with a key published on its own host.
			builder.clientAuthenticationMethod(ClientAuthenticationMethod.PRIVATE_KEY_JWT);
			client.jwkSetUrl(metadata.jwksUri()).tokenEndpointAuthenticationSigningAlgorithm(SignatureAlgorithm.RS256);
		}
		else {
			builder.clientAuthenticationMethod(ClientAuthenticationMethod.NONE);
		}
		return builder.clientSettings(client.build()).build();
	}

	private RegisteredClient.Builder base(String id, String clientId, String name) {
		return RegisteredClient.withId(id)
			.clientId(clientId)
			.clientName(name)
			.clientIdIssuedAt(Instant.now())
			.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
			.authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
			.scopes(scopes -> scopes.addAll(McpScopes.ALL))
			.tokenSettings(TokenSettings.builder()
				.accessTokenFormat(OAuth2TokenFormat.SELF_CONTAINED)
				.accessTokenTimeToLive(settings.accessTokenLifetime())
				.refreshTokenTimeToLive(settings.refreshTokenLifetime())
				.reuseRefreshTokens(false)
				.build());
	}

	/** The same client always gets the same identifier, so a document read again replaces its row. */
	private static String idOf(String clientId) {
		return UUID.nameUUIDFromBytes(clientId.getBytes(StandardCharsets.UTF_8)).toString();
	}

}
