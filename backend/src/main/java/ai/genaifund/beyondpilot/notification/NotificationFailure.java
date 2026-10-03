package ai.genaifund.beyondpilot.notification;

import ai.genaifund.beyondpilot.FailureCategory;
import ai.genaifund.beyondpilot.FailureReason;

public enum NotificationFailure implements FailureReason {

	EMAIL_NOT_SENT("NOTIFICATION_EMAIL_NOT_SENT", FailureCategory.SERVICE_UNAVAILABLE,
			"The email could not be sent. Try again in a moment.");

	private final String code;
	private final FailureCategory category;
	private final String message;

	NotificationFailure(String code, FailureCategory category, String message) {
		this.code = code;
		this.category = category;
		this.message = message;
	}

	@Override
	public String code() {
		return code;
	}

	@Override
	public FailureCategory category() {
		return category;
	}

	@Override
	public String message() {
		return message;
	}
}
