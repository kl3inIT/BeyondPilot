package ai.genaifund.beyondpilot.identity.signin;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import ai.genaifund.beyondpilot.identity.IdentityProperties;
import ai.genaifund.beyondpilot.identity.persistence.SignInChallengeRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * When an address may have another sign-in code. A code used to sign in is gone, so only codes still waiting count:
 * a short pause between two codes, a number of codes an hour, and a pause for an address that keeps getting wrong
 * codes. Wrong codes pause it for the rest of the hour, so someone typing wrong codes into another person's sign-in
 * keeps them out briefly; a larger number in a day pauses it for the day, so slow guessing stays too slow to pay.
 * Google sign-in is never paused.
 */
@Component
class SignInCodeLimits {

	static final Duration WINDOW = Duration.ofHours(1);

	static final Duration DAY = Duration.ofDays(1);

	private final SignInChallengeRepository challenges;

	private final IdentityProperties properties;

	SignInCodeLimits(SignInChallengeRepository challenges, IdentityProperties properties) {
		this.challenges = challenges;
		this.properties = properties;
	}

	/** When the address may have another code, or {@code null} when it may have one now. */
	@Nullable Instant refusedUntil(String email, Instant now) {
		Instant since = now.minus(WINDOW);
		List<Instant> sent = challenges.createdSince(email, since);
		Instant latest = sent.isEmpty() ? null : sent.getLast();
		if (latest != null && latest.plus(properties.signInCodeCooldown()).isAfter(now)) {
			return latest.plus(properties.signInCodeCooldown());
		}
		if (sent.size() >= properties.signInCodeHourlyLimit()) {
			return sent.get(sent.size() - properties.signInCodeHourlyLimit()).plus(WINDOW);
		}
		Instant dayAgo = now.minus(DAY);
		if (challenges.wrongCodesSince(email, dayAgo) >= properties.signInCodeDailyWrongLimit()) {
			Instant firstWrong = challenges.firstWrongSince(email, dayAgo);
			return (firstWrong == null ? now : firstWrong).plus(DAY);
		}
		if (challenges.wrongCodesSince(email, since) >= properties.signInCodeWrongLimit()) {
			Instant firstWrong = challenges.firstWrongSince(email, since);
			return (firstWrong == null ? now : firstWrong).plus(WINDOW);
		}
		return null;
	}
}
