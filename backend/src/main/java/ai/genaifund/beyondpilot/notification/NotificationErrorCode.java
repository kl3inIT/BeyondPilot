package ai.genaifund.beyondpilot.notification;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum NotificationErrorCode implements ErrorCode {

	EMAIL_NOT_SENT("NOTIFICATION_EMAIL_NOT_SENT", ErrorCategory.SERVICE_UNAVAILABLE,
			"The email could not be sent. Try again in a moment.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	NotificationErrorCode(String code, ErrorCategory category, String message) {
		this.code = code;
		this.category = category;
		this.message = message;
	}

	@Override
	public String code() {
		return code;
	}

	@Override
	public ErrorCategory category() {
		return category;
	}

	@Override
	public String message() {
		return message;
	}
}
