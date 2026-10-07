package ai.genaifund.beyondpilot.identity.oauth;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import org.jspecify.annotations.Nullable;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationContext;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationValidator;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationConsentAuthenticationToken;

/**
 * The rules of an authorization request and of the person's consent. A request may name only one of BeyondPilot's two
 * servers as its resource, and must ask for that server's scope. The operators' scope is granted to an operator only: when someone else consents, it is taken
 * out of the consent, so the app receives nothing for the operator server. The operator server reads the role again on
 * every call, so a role withdrawn later stops it too.
 */
final class McpConsent {

	private final McpTokens tokens;

	private final IdentityService identity;

	McpConsent(McpTokens tokens, IdentityService identity) {
		this.tokens = tokens;
		this.identity = identity;
	}

	/** Redirect address ({@code localhost} on any port), scope, then the resource. */
	Consumer<OAuth2AuthorizationCodeRequestAuthenticationContext> requestValidator() {
		return RedirectAddresses.validator()
			.andThen(OAuth2AuthorizationCodeRequestAuthenticationValidator.DEFAULT_SCOPE_VALIDATOR)
			.andThen(context -> {
				OAuth2AuthorizationCodeRequestAuthenticationToken request = context.getAuthentication();
				Object resource = request.getAdditionalParameters().get(McpTokens.RESOURCE);
				if (resource != null && !(resource instanceof String value && tokens.isServer(value)
						&& request.getScopes().contains(tokens.scopeOf(value)))) {
					throw RedirectAddresses.invalid(McpTokens.RESOURCE, request);
				}
			});
	}

	/**
	 * Takes the operators' scope out of what anyone else consents to, before Spring reads the consent: the token, the
	 * stored consent and the authorization then all leave it out. With nothing left, the app is told access was denied.
	 */
	AuthenticationProvider operatorScopeForOperatorsOnly(AuthenticationProvider consents) {
		return new AuthenticationProvider() {

			@Override
			public @Nullable Authentication authenticate(Authentication authentication) {
				OAuth2AuthorizationConsentAuthenticationToken consent = (OAuth2AuthorizationConsentAuthenticationToken) authentication;
				if (!consent.getScopes().contains(McpScopes.RESEARCH) || isOperator(consent.getPrincipal())) {
					return consents.authenticate(consent);
				}
				Set<String> scopes = new HashSet<>(consent.getScopes());
				scopes.remove(McpScopes.RESEARCH);
				OAuth2AuthorizationConsentAuthenticationToken allowed = new OAuth2AuthorizationConsentAuthenticationToken(
						consent.getAuthorizationUri(), consent.getClientId(), (Authentication) consent.getPrincipal(),
						consent.getState(), scopes, consent.getAdditionalParameters());
				allowed.setDetails(consent.getDetails());
				return consents.authenticate(allowed);
			}

			@Override
			public boolean supports(Class<?> authentication) {
				return consents.supports(authentication);
			}

		};
	}

	private boolean isOperator(@Nullable Object principal) {
		if (!(principal instanceof Authentication person)) {
			return false;
		}
		try {
			return identity.isOperator(new Actor(UUID.fromString(person.getName())));
		}
		catch (IllegalArgumentException notAnAccount) {
			return false;
		}
	}

}
