package ai.genaifund.beyondpilot.messaging;

import java.time.Duration;

import ai.genaifund.beyondpilot.BusinessException;
import org.jspecify.annotations.Nullable;

public final class MessagingException extends BusinessException {

	private final @Nullable Duration retryAfter;

	MessagingException(MessagingErrorCode errorCode, String diagnosticMessage) {
		this(errorCode, diagnosticMessage, null);
	}

	MessagingException(MessagingErrorCode errorCode, String diagnosticMessage, @Nullable Duration retryAfter) {
		super(errorCode, diagnosticMessage);
		this.retryAfter = retryAfter;
	}

	@Override
	public @Nullable Duration retryAfter() {
		return retryAfter;
	}
}
