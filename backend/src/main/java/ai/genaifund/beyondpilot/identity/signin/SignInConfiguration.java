package ai.genaifund.beyondpilot.identity.signin;

import ai.genaifund.beyondpilot.identity.IdentityProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.authentication.ott.JdbcOneTimeTokenService;
import org.springframework.security.authentication.ott.OneTimeTokenService;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.web.authentication.ott.DefaultGenerateOneTimeTokenRequestResolver;
import org.springframework.security.web.authentication.ott.GenerateOneTimeTokenRequestResolver;

/** The pieces Spring Security needs from this module; the filter chain itself belongs to the config module. */
@Configuration(proxyBeanMethods = false)
class SignInConfiguration {

	/** Tokens live in the database, so a link works on any instance and across a restart. */
	@Bean
	OneTimeTokenService oneTimeTokenService(JdbcOperations jdbc) {
		return new JdbcOneTimeTokenService(jdbc);
	}

	@Bean
	GenerateOneTimeTokenRequestResolver generateOneTimeTokenRequestResolver(IdentityProperties properties) {
		DefaultGenerateOneTimeTokenRequestResolver resolver = new DefaultGenerateOneTimeTokenRequestResolver();
		resolver.setExpiresIn(properties.signInLinkLifetime());
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
}
