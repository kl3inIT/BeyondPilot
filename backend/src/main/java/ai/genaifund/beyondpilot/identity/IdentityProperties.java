package ai.genaifund.beyondpilot.identity;

import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.constraints.Min;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * @param signInCodeLifetime how long an emailed sign-in code works
 * @param signInCodeLimit how many unexpired codes one address may hold before further requests are refused
 * @param signInCodeAttempts how many wrong codes are accepted before the code stops working
 * @param operatorEmails addresses that become operators when they sign in; the way the first operators exist
 * @param google the Google OAuth client, absent where Google sign-in is not configured
 */
@Validated
@ConfigurationProperties("beyondpilot.identity")
public record IdentityProperties(@DefaultValue("15m") Duration signInCodeLifetime,
		@DefaultValue("3") @Min(1) int signInCodeLimit, @DefaultValue("5") @Min(1) int signInCodeAttempts,
		@DefaultValue Set<String> operatorEmails, @Nullable Google google) {

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
