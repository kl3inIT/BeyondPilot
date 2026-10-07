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
 * @param signInCodeCooldown how long an address waits between two codes it has not used
 * @param signInCodeHourlyLimit how many codes one address may have in an hour without signing in
 * @param signInCodeAttempts how many guesses one code takes before it stops working
 * @param signInCodeWrongLimit how many wrong codes one address takes in an hour, over all its codes, before no new code
 * is sent to it for the rest of that hour
 * @param signInCodeDailyWrongLimit how many wrong codes one address takes in a day before no new code is sent to it for
 * the rest of that day
 * @param operatorEmails addresses that become operators when they sign in; the way the first operators exist
 * @param google the Google OAuth client, absent where Google sign-in is not configured
 */
@Validated
@ConfigurationProperties("beyondpilot.identity")
public record IdentityProperties(@DefaultValue("15m") Duration signInCodeLifetime,
		@DefaultValue("60s") Duration signInCodeCooldown, @DefaultValue("10") @Min(1) int signInCodeHourlyLimit,
		@DefaultValue("5") @Min(1) int signInCodeAttempts, @DefaultValue("15") @Min(1) int signInCodeWrongLimit,
		@DefaultValue("30") @Min(1) int signInCodeDailyWrongLimit,
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
