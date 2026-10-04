package ai.genaifund.beyondpilot.identity.signin;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.security.authentication.ott.OneTimeToken;

/**
 * A freshly generated sign-in code on its way to the email. The challenge identifier goes to the browser's session,
 * the code to the mailbox; neither is enough alone.
 */
final class SignInCode implements OneTimeToken {

	private static final long serialVersionUID = 1L;

	private final @Nullable UUID challengeId;
	private final String code;
	private final String email;
	private final Instant expiresAt;

	SignInCode(@Nullable UUID challengeId, String code, String email, Instant expiresAt) {
		this.challengeId = challengeId;
		this.code = code;
		this.email = email;
		this.expiresAt = expiresAt;
	}

	/** The address already holds its share of working codes: nothing was stored and nothing is to be sent. */
	static SignInCode refused(String email, Instant at) {
		return new SignInCode(null, "", email, at);
	}

	/** The challenge the code belongs to, or {@code null} when the request was refused. */
	@Nullable UUID challengeId() {
		return challengeId;
	}

	@Override
	public String getTokenValue() {
		return code;
	}

	@Override
	public String getUsername() {
		return email;
	}

	@Override
	public Instant getExpiresAt() {
		return expiresAt;
	}
}
