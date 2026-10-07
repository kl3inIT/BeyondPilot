package ai.genaifund.beyondpilot.identity.oauth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.persistence.OAuthTableRepository;
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
 * The AI apps that may sign in. An app with a client ID metadata document is read from its trusted host the first time
 * and stored, so a later lookup by Spring's own identifier still finds it, and read again after a day. Cursor, which
 * has no document yet, is a client BeyondPilot registers itself. No other client exists: there is no dynamic
 * registration, which MCP 2026-07-28 deprecates.
 */
@Component
class McpClients implements RegisteredClientRepository {

	/** How long a stored document is trusted before it is read again. */
	private static final Duration DOCUMENT_REFRESH = Duration.ofDays(1);

	/** Cursor's client, which a person puts in Cursor's {@code mcp.json}. */
	static final String CURSOR = "cursor";

	private final JdbcRegisteredClientRepository stored;

	private final ClientMetadataDocuments documents;

	private final OAuthSettings settings;

	private final OAuthTableRepository tables;

	McpClients(JdbcOperations jdbc, ClientMetadataDocuments documents, OAuthSettings settings,
			OAuthTableRepository tables) {
		this.stored = new JdbcRegisteredClientRepository(jdbc);
		this.documents = documents;
		this.settings = settings;
		this.tables = tables;
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
			return known;
		}
		Instant read = known == null ? null : known.getClientIdIssuedAt();
		if (known != null && read != null && read.isAfter(Instant.now().minus(DOCUMENT_REFRESH))) {
			return known;
		}
		// A document that cannot be read now keeps the version stored, so a short outage of the app's host signs
		// nobody out; one never read is refused.
		return documents.fetch(clientId).map(metadata -> {
			RegisteredClient client = fromDocument(metadata);
			stored.save(client);
			tables.markRead(client.getId(), Instant.now());
			return client;
		}).orElse(known);
	}

	/** Registers Cursor's client, or brings it up to date. */
	void registerCursor() {
		stored.save(base(idOf(CURSOR), CURSOR, "Cursor", Instant.now())
			.clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
			.redirectUris(uris -> uris.addAll(List.of("http://localhost:8787/callback",
					"https://www.cursor.com/agents/mcp/oauth/callback", "cursor://anysphere.cursor-mcp/oauth/callback")))
			.clientSettings(ClientSettings.builder().requireProofKey(true).requireAuthorizationConsent(true).build())
			.build());
	}

	private RegisteredClient fromDocument(ClientMetadataDocuments.ClientMetadata metadata) {
		RegisteredClient.Builder builder = base(idOf(metadata.clientId()), metadata.clientId(), metadata.name(),
				Instant.now())
			.redirectUris(uris -> uris.addAll(metadata.redirectUris()));
		ClientSettings.Builder client = ClientSettings.builder().requireProofKey(true).requireAuthorizationConsent(true);
		if ("private_key_jwt".equals(metadata.authenticationMethod()) && metadata.jwksUri() != null) {
			// ChatGPT signs its token requests with a key published at its jwks_uri.
			builder.clientAuthenticationMethod(ClientAuthenticationMethod.PRIVATE_KEY_JWT);
			client.jwkSetUrl(metadata.jwksUri()).tokenEndpointAuthenticationSigningAlgorithm(SignatureAlgorithm.RS256);
		}
		else {
			builder.clientAuthenticationMethod(ClientAuthenticationMethod.NONE);
		}
		return builder.clientSettings(client.build()).build();
	}

	private RegisteredClient.Builder base(String id, String clientId, String name, Instant read) {
		return RegisteredClient.withId(id)
			.clientId(clientId)
			.clientName(name)
			.clientIdIssuedAt(read)
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
