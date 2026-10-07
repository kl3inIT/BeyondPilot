package ai.genaifund.beyondpilot.identity.oauth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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
 * What an access token says. Its audience is the one MCP server it works on: the {@code resource} the app asked for
 * (RFC 8707), else the server its scope belongs to, because Codex does not send {@code resource}. A connection ends
 * {@code connectionLifetime} after the person's consent, however often it was refreshed.
 */
final class McpTokens implements OAuth2TokenCustomizer<JwtEncodingContext> {

	static final String RESOURCE = "resource";

	private final OAuthSettings settings;

	McpTokens(OAuthSettings settings) {
		this.settings = settings;
	}

	@Override
	public void customize(JwtEncodingContext context) {
		if (!OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) {
			return;
		}
		OAuth2Authorization authorization = context.getAuthorization();
		if (authorization != null && AuthorizationGrantType.REFRESH_TOKEN.equals(context.getAuthorizationGrantType())) {
			OAuth2Authorization.Token<OAuth2AuthorizationCode> code = authorization.getToken(OAuth2AuthorizationCode.class);
			Instant consented = code == null ? null : code.getToken().getIssuedAt();
			if (consented == null || consented.plus(settings.connectionLifetime()).isBefore(Instant.now())) {
				throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT,
						"The connection has ended; connect the app again.", null));
			}
		}
		// A list Spring's stored-authorization reader accepts back.
		context.getClaims().audience(new ArrayList<>(List.of(audience(authorization, context.getAuthorizedScopes()))));
	}

	/** The server the token works on. */
	String audience(@Nullable OAuth2Authorization authorization, Set<String> scopes) {
		String requested = resourceOf(authorization);
		if (requested != null) {
			return requested;
		}
		return scopes.contains(McpScopes.RESEARCH) ? settings.operatorServer() : settings.userServer();
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
