package ai.genaifund.beyondpilot.identity.oauth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityException;
import ai.genaifund.beyondpilot.identity.IdentityService;
import org.jspecify.annotations.Nullable;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;

/**
 * What an access token says, checked again at every issue, refresh included. Its audience is the one MCP server it
 * works on: the {@code resource} the app asked for (RFC 8707), else the server its scope belongs to, because Codex does
 * not send {@code resource}; the token must carry that server's scope. The operators' scope needs an operator now, so a
 * role withdrawn after consent stops the next token. A connection ends {@code connectionLifetime} after the person's
 * consent, however often it was refreshed, and with the account when it is disabled.
 */
final class McpTokens implements OAuth2TokenCustomizer<JwtEncodingContext> {

	static final String RESOURCE = "resource";

	/** The app the token was issued to (RFC 9068). */
	static final String CLIENT_ID = "client_id";

	/** The connection the token belongs to: the authorization the person consented to. */
	static final String CONNECTION = "connection";

	private final OAuthSettings settings;

	private final IdentityService identity;

	McpTokens(OAuthSettings settings, IdentityService identity) {
		this.settings = settings;
		this.identity = identity;
	}

	@Override
	public void customize(JwtEncodingContext context) {
		if (!OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) {
			return;
		}
		OAuth2Authorization authorization = context.getAuthorization();
		boolean refresh = AuthorizationGrantType.REFRESH_TOKEN.equals(context.getAuthorizationGrantType());
		if (authorization != null && refresh) {
			OAuth2Authorization.Token<OAuth2AuthorizationCode> code = authorization.getToken(OAuth2AuthorizationCode.class);
			Instant consented = code == null ? null : code.getToken().getIssuedAt();
			if (consented == null || consented.plus(settings.connectionLifetime()).isBefore(Instant.now())) {
				throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT,
						"The connection has ended; connect the app again.", null));
			}
		}
		if (!isActive(context.getPrincipal().getName())) {
			throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT,
					"The account is disabled.", null));
		}
		Set<String> scopes = context.getAuthorizedScopes();
		String audience = audience(authorization, scopes);
		String serverScope = audience.equals(settings.operatorServer()) ? McpScopes.RESEARCH : McpScopes.READ;
		boolean operatorAllowed = !scopes.contains(McpScopes.RESEARCH)
				|| isOperator(context.getPrincipal().getName());
		if (!scopes.contains(serverScope) || !operatorAllowed) {
			throw new OAuth2AuthenticationException(new OAuth2Error(
					refresh ? OAuth2ErrorCodes.INVALID_GRANT : OAuth2ErrorCodes.INVALID_SCOPE,
					"The connection does not allow this server; connect the app again.", null));
		}
		// A list Spring's stored-authorization reader accepts back.
		context.getClaims().audience(new ArrayList<>(List.of(audience)));
		// Which app, and which connection: each call to an MCP server checks the connection still stands, so a revoke
		// takes effect at once rather than when the token lapses.
		context.getClaims().claim(CLIENT_ID, context.getRegisteredClient().getClientId());
		if (authorization != null) {
			context.getClaims().claim(CONNECTION, authorization.getId());
		}
	}

	/** Whether the account that connected the app may still use BeyondPilot; a disabled one ends its connections. */
	private boolean isActive(String accountId) {
		try {
			identity.requireActive(new Actor(UUID.fromString(accountId)));
			return true;
		}
		catch (IdentityException | IllegalArgumentException disabledOrUnknown) {
			return false;
		}
	}

	private boolean isOperator(String accountId) {
		try {
			return identity.isOperator(new Actor(UUID.fromString(accountId)));
		}
		catch (IllegalArgumentException notAnAccount) {
			return false;
		}
	}

	/** The server the token works on. */
	String audience(@Nullable OAuth2Authorization authorization, Set<String> scopes) {
		String requested = resourceOf(authorization);
		if (requested != null) {
			return requested;
		}
		return scopes.contains(McpScopes.RESEARCH) ? settings.operatorServer() : settings.userServer();
	}

	/** The scope a token for this server must carry. */
	String scopeOf(String server) {
		String trimmed = server.endsWith("/") ? server.substring(0, server.length() - 1) : server;
		return trimmed.equals(settings.operatorServer()) ? McpScopes.RESEARCH : McpScopes.READ;
	}

	/** Whether this is one of BeyondPilot's two servers, with or without a trailing slash. */
	boolean isServer(String resource) {
		String trimmed = resource.endsWith("/") ? resource.substring(0, resource.length() - 1) : resource;
		return trimmed.equals(settings.userServer()) || trimmed.equals(settings.operatorServer());
	}

	private @Nullable String resourceOf(@Nullable OAuth2Authorization authorization) {
		if (authorization == null) {
			return null;
		}
		OAuth2AuthorizationRequest request = authorization.getAttribute(OAuth2AuthorizationRequest.class.getName());
		Object resource = request == null ? null : request.getAdditionalParameters().get(RESOURCE);
		if (!(resource instanceof String value) || !isServer(value)) {
			return null;
		}
		return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
	}

}
