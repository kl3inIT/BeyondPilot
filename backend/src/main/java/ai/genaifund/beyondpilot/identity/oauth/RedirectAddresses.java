package ai.genaifund.beyondpilot.identity.oauth;

import java.util.Locale;
import java.util.function.Consumer;

import org.jspecify.annotations.Nullable;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationContext;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationException;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationValidator;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Checks an authorization request's redirect address and resource. Spring already matches a redirect to {@code 127.0.0.1}
 * or {@code ::1} on any port, as RFC 8252 asks for apps on this computer; Claude Code and Cursor redirect to
 * {@code localhost} on a port they pick, so {@code localhost} is matched the same way. Anything else must match exactly.
 */
final class RedirectAddresses {

	private RedirectAddresses() {
	}

	static boolean isThisComputer(@Nullable String host) {
		if (host == null) {
			return false;
		}
		String lower = host.toLowerCase(Locale.ROOT);
		return lower.equals("localhost") || lower.equals("127.0.0.1") || lower.equals("[::1]") || lower.equals("::1");
	}

	/**
	 * The redirect check: for the client of agents on this computer, any address on it; for others, {@code localhost}
	 * on any port; then Spring's own.
	 */
	static Consumer<OAuth2AuthorizationCodeRequestAuthenticationContext> validator() {
		return context -> {
			OAuth2AuthorizationCodeRequestAuthenticationToken request = context.getAuthentication();
			String requested = request.getRedirectUri();
			RegisteredClient client = context.getRegisteredClient();
			if (requested != null && (McpClients.LOCAL.equals(client.getClientId()) ? isOnThisComputer(requested)
					: matchesLocalhostOnAnyPort(requested, client))) {
				return;
			}
			OAuth2AuthorizationCodeRequestAuthenticationValidator.DEFAULT_REDIRECT_URI_VALIDATOR.accept(context);
		};
	}

	/** An {@code http} address on this computer, any port and path, with nothing a parser could read two ways. */
	static boolean isOnThisComputer(String address) {
		try {
			UriComponents uri = UriComponentsBuilder.fromUriString(address).build();
			return "http".equals(uri.getScheme()) && isThisComputer(uri.getHost()) && uri.getFragment() == null
					&& uri.getUserInfo() == null;
		}
		catch (IllegalArgumentException malformed) {
			return false;
		}
	}

	private static boolean matchesLocalhostOnAnyPort(String requested, RegisteredClient client) {
		UriComponents asked;
		try {
			asked = UriComponentsBuilder.fromUriString(requested).build();
		}
		catch (IllegalArgumentException malformed) {
			return false;
		}
		if (!"http".equals(asked.getScheme()) || !"localhost".equalsIgnoreCase(asked.getHost())
				|| asked.getFragment() != null) {
			return false;
		}
		for (String registered : client.getRedirectUris()) {
			UriComponentsBuilder candidate = UriComponentsBuilder.fromUriString(registered).port(asked.getPort());
			if (candidate.build().toUriString().equals(asked.toUriString())) {
				return true;
			}
		}
		return false;
	}

	static OAuth2AuthorizationCodeRequestAuthenticationException invalid(String parameter,
			OAuth2AuthorizationCodeRequestAuthenticationToken request) {
		return new OAuth2AuthorizationCodeRequestAuthenticationException(
				new OAuth2Error(OAuth2ErrorCodes.INVALID_REQUEST, "OAuth 2.0 Parameter: " + parameter, null), request);
	}

}
