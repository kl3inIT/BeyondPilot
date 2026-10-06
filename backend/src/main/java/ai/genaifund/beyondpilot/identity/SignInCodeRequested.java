package ai.genaifund.beyondpilot.identity;

import java.time.Duration;
import java.util.Objects;

/**
 * A person asked for a sign-in code, which must now reach their mailbox. Unlike other events it carries a secret, the
 * code in clear, because the code exists in clear only at this moment. It is therefore published to synchronous
 * listeners only, never recorded in the event publication registry, and its {@code toString} leaves the code out.
 * @param validFor how long the code works
 */
public record SignInCodeRequested(String email, String code, Duration validFor) {

	public SignInCodeRequested {
		Objects.requireNonNull(email, "email must not be null");
		Objects.requireNonNull(code, "code must not be null");
		Objects.requireNonNull(validFor, "validFor must not be null");
	}

	@Override
	public String toString() {
		return "SignInCodeRequested[validFor=" + validFor + "]";
	}

}
