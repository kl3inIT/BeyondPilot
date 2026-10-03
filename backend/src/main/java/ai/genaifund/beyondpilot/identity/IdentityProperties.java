package ai.genaifund.beyondpilot.identity;

import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.constraints.NotNull;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * @param publicUrl the origin people open the web application at; emailed links start with it
 * @param signInLinkLifetime how long an emailed sign-in link works
 * @param signInLinkLimit how many unexpired links one address may hold before further requests are refused
 * @param operatorEmails addresses that become operators when they sign in; the way the first operators exist
 * @param google the Google OAuth client, absent where Google sign-in is not configured
 */
@Validated
@ConfigurationProperties("beyondpilot.identity")
public record IdentityProperties(@NotNull URI publicUrl, @DefaultValue("15m") Duration signInLinkLifetime,
		@DefaultValue("3") int signInLinkLimit, @DefaultValue Set<String> operatorEmails, @Nullable Google google) {

	public IdentityProperties {
		operatorEmails = operatorEmails.stream()
			.map(email -> email.strip().toLowerCase(Locale.ROOT))
			.filter(email -> !email.isEmpty())
			.collect(Collectors.toUnmodifiableSet());
	}

	boolean isOperatorEmail(String email) {
		return operatorEmails.contains(email.toLowerCase(Locale.ROOT));
	}

	public record Google(String clientId, String clientSecret) {
	}
}
