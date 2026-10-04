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

	private final ErrorCode errorCode;

	protected BusinessException(ErrorCode errorCode, String diagnosticMessage) {
		super(diagnosticMessage);
		this.errorCode = requireValid(errorCode);
	}

	protected BusinessException(ErrorCode errorCode, String diagnosticMessage, Throwable cause) {
		super(diagnosticMessage, cause);
		this.errorCode = requireValid(errorCode);
	}

	public String code() {
		return errorCode.code();
	}

	public ErrorCategory category() {
		return errorCode.category();
	}

	public String safeMessage() {
		return errorCode.message();
	}

	/**
	 * How long a client waits before retrying, sent as {@code Retry-After}. A {@code LIMIT_EXCEEDED} or
	 * {@code SERVICE_UNAVAILABLE} failure overrides it.
	 */
	public @Nullable Duration retryAfter() {
		return null;
	}

	private static ErrorCode requireValid(ErrorCode errorCode) {
		Objects.requireNonNull(errorCode, "errorCode must not be null");
		String code = errorCode.code();
		if (code.length() > MAX_CODE_LENGTH || !CODE.matcher(code).matches()) {
			throw new IllegalArgumentException(
					"A failure code is upper snake case and at most " + MAX_CODE_LENGTH + " characters: " + code);
		}
		Objects.requireNonNull(errorCode.category(), "category must not be null");
		if (errorCode.message().isBlank()) {
			throw new IllegalArgumentException("A failure message must not be blank: " + code);
		}
		return errorCode;
	}
}
