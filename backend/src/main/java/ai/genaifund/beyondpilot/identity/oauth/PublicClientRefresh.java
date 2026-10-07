package ai.genaifund.beyondpilot.identity.oauth;

import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.keygen.Base64StringKeyGenerator;
import org.springframework.security.crypto.keygen.StringKeyGenerator;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.web.authentication.AuthenticationConverter;

/**
 * Refresh tokens for apps that hold no secret. Spring issues none to such a client and authenticates its token requests
 * only with a PKCE verifier, which a refresh has none of; OAuth 2.1 allows them when each use replaces the token, as
 * every BeyondPilot client is set to ({@code reuseRefreshTokens(false)}), and Claude and ChatGPT expect them. The
 * refresh token itself is the proof: it is long, random, stored by the server and good for one use.
 */
final class PublicClientRefresh {

	private PublicClientRefresh() {
	}

	/** Issues a refresh token to every client, public ones included. */
	static final class TokenGenerator implements OAuth2TokenGenerator<OAuth2RefreshToken> {

		private final StringKeyGenerator values = new Base64StringKeyGenerator(Base64.getUrlEncoder().withoutPadding(), 96);

		@Override
		public @Nullable OAuth2RefreshToken generate(OAuth2TokenContext context) {
			if (!OAuth2TokenType.REFRESH_TOKEN.equals(context.getTokenType())) {
				return null;
			}
			Instant issuedAt = Instant.now();
			return new OAuth2RefreshToken(values.generateKey(), issuedAt,
					issuedAt.plus(context.getRegisteredClient().getTokenSettings().getRefreshTokenTimeToLive()));
		}

	}

	/** Reads a public client's refresh request: a {@code client_id} and no secret, no assertion, no basic header. */
	static final class RequestConverter implements AuthenticationConverter {

		@Override
		public @Nullable Authentication convert(HttpServletRequest request) {
			if (!AuthorizationGrantType.REFRESH_TOKEN.getValue().equals(request.getParameter(OAuth2ParameterNames.GRANT_TYPE))
					|| request.getHeader(HttpHeaders.AUTHORIZATION) != null
					|| request.getParameter(OAuth2ParameterNames.CLIENT_SECRET) != null
					|| request.getParameter(OAuth2ParameterNames.CLIENT_ASSERTION) != null) {
				return null;
			}
			String clientId = request.getParameter(OAuth2ParameterNames.CLIENT_ID);
			if (clientId == null || clientId.isBlank() || request.getParameterValues(OAuth2ParameterNames.CLIENT_ID).length != 1) {
				return null;
			}
			Map<String, Object> parameters = new HashMap<>();
			request.getParameterMap().forEach((name, values) -> {
				if (!name.equals(OAuth2ParameterNames.CLIENT_ID) && values.length == 1) {
					parameters.put(name, values[0]);
				}
			});
			return new OAuth2ClientAuthenticationToken(clientId, ClientAuthenticationMethod.NONE, null, parameters);
		}

	}

	/** Authenticates that request: the client exists, holds no secret and may refresh. */
	static final class ClientProvider implements AuthenticationProvider {

		private final RegisteredClientRepository clients;

		ClientProvider(RegisteredClientRepository clients) {
			this.clients = clients;
		}

		@Override
		public @Nullable Authentication authenticate(Authentication authentication) throws AuthenticationException {
			OAuth2ClientAuthenticationToken request = (OAuth2ClientAuthenticationToken) authentication;
			if (!ClientAuthenticationMethod.NONE.equals(request.getClientAuthenticationMethod())
					|| !AuthorizationGrantType.REFRESH_TOKEN.getValue()
						.equals(request.getAdditionalParameters().get(OAuth2ParameterNames.GRANT_TYPE))) {
				return null;
			}
			RegisteredClient client = clients.findByClientId(String.valueOf(request.getPrincipal()));
			if (client == null || !client.getClientAuthenticationMethods().contains(ClientAuthenticationMethod.NONE)
					|| !client.getAuthorizationGrantTypes().contains(AuthorizationGrantType.REFRESH_TOKEN)) {
				throw new OAuth2AuthenticationException(OAuth2ErrorCodes.INVALID_CLIENT);
			}
			return new OAuth2ClientAuthenticationToken(client, ClientAuthenticationMethod.NONE, null);
		}

		@Override
		public boolean supports(Class<?> authentication) {
			return OAuth2ClientAuthenticationToken.class.isAssignableFrom(authentication);
		}

	}

}
