package ai.genaifund.beyondpilot;

import java.time.Duration;
import java.util.Objects;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;

/**
 * An expected failure of a module operation. Its code, category and safe message reach the client; the exception
 * message is diagnostic and reaches logs only.
 */
public abstract class BusinessException extends RuntimeException {

	private static final Pattern CODE = Pattern.compile("[A-Z][A-Z0-9_]+[A-Z0-9]");
	private static final int MAX_CODE_LENGTH = 63;

	private final FailureReason reason;

	protected BusinessException(FailureReason reason, String diagnosticMessage) {
		super(diagnosticMessage);
		this.reason = requireValid(reason);
	}

	protected BusinessException(FailureReason reason, String diagnosticMessage, Throwable cause) {
		super(diagnosticMessage, cause);
		this.reason = requireValid(reason);
	}

	public String code() {
		return reason.code();
	}

	public FailureCategory category() {
		return reason.category();
	}

	public String safeMessage() {
		return reason.message();
	}

	/**
	 * How long a client waits before retrying, sent as {@code Retry-After}. A {@code LIMIT_EXCEEDED} or
	 * {@code SERVICE_UNAVAILABLE} failure overrides it.
	 */
	public @Nullable Duration retryAfter() {
		return null;
	}

	private static FailureReason requireValid(FailureReason reason) {
		Objects.requireNonNull(reason, "reason must not be null");
		String code = reason.code();
		if (code.length() > MAX_CODE_LENGTH || !CODE.matcher(code).matches()) {
			throw new IllegalArgumentException(
					"A failure code is upper snake case and at most " + MAX_CODE_LENGTH + " characters: " + code);
		}
		Objects.requireNonNull(reason.category(), "category must not be null");
		if (reason.message().isBlank()) {
			throw new IllegalArgumentException("A failure message must not be blank: " + code);
		}
		return reason;
	}
}
