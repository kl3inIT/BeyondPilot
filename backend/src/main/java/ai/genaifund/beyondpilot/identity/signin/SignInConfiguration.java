package ai.genaifund.beyondpilot.identity.signin;

import ai.genaifund.beyondpilot.identity.AccountAdministration;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityProperties;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.web.authentication.ott.DefaultGenerateOneTimeTokenRequestResolver;
import org.springframework.security.web.authentication.ott.GenerateOneTimeTokenRequestResolver;

/** The pieces Spring Security needs from this module; the filter chain itself belongs to the config module. */
@Configuration(proxyBeanMethods = false)
class SignInConfiguration {

	@Bean
	GenerateOneTimeTokenRequestResolver generateOneTimeTokenRequestResolver(IdentityProperties properties) {
		DefaultGenerateOneTimeTokenRequestResolver resolver = new DefaultGenerateOneTimeTokenRequestResolver();
		resolver.setExpiresIn(properties.signInCodeLifetime());
		return resolver;
	}

	/** Google sign-in exists only where a client is configured; production requires one (application-production.yaml). */
	@Bean
	@ConditionalOnProperty("beyondpilot.identity.google.client-id")
	ClientRegistrationRepository clientRegistrationRepository(IdentityProperties properties) {
		IdentityProperties.Google google = properties.google();
		if (google == null || google.clientId().isBlank() || google.clientSecret().isBlank()) {
			throw new IllegalStateException("beyondpilot.identity.google needs both client-id and client-secret");
		}
		return new InMemoryClientRegistrationRepository(CommonOAuth2Provider.GOOGLE.getBuilder("google")
			.clientId(google.clientId())
			.clientSecret(google.clientSecret())
			.scope("openid", "email", "profile")
			.build());
	}

	/**
	 * Lets the filter chain keep a path for operators without naming this module (ADR 0004): a module that
	 * {@code identity} depends on cannot ask it who the caller is. The role is read on every request.
	 */
	@Bean
	AuthorizationManager<RequestAuthorizationContext> operatorsOnly(AccountAdministration accounts) {
		return (authentication, request) -> {
			Actor actor = actorOf(authentication.get());
			return new AuthorizationDecision(actor != null && accounts.isOperator(actor));
		};
	}

	private static @Nullable Actor actorOf(@Nullable Authentication authentication) {
		return switch (authentication == null ? null : authentication.getPrincipal()) {
			case AccountUserDetails details -> details.getActor();
			case AccountOidcUser user -> user.getActor();
			case null, default -> null;
		};
	}
}
