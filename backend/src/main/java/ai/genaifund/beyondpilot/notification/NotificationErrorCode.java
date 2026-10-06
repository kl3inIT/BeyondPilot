package ai.genaifund.beyondpilot.notification;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum NotificationErrorCode implements ErrorCode {

	EMAIL_NOT_SENT("NOTIFICATION_EMAIL_NOT_SENT", ErrorCategory.SERVICE_UNAVAILABLE,
			"The email could not be sent. Try again in a moment."),

	SETTINGS_INCOMPLETE("NOTIFICATION_SETTINGS_INCOMPLETE", ErrorCategory.VALIDATION,
			"The provider chosen needs more to connect: fill in its fields, including its secret."),

	SETTINGS_CHANGED("NOTIFICATION_SETTINGS_CHANGED", ErrorCategory.CONFLICT,
			"Someone changed the email settings since you opened them. Reload and try again."),

	ENCRYPTION_KEY_MISSING("NOTIFICATION_ENCRYPTION_KEY_MISSING", ErrorCategory.SERVICE_UNAVAILABLE,
			"Secrets cannot be stored: the server has no encryption key for them."),

	TEMPLATE_NOT_FOUND("NOTIFICATION_TEMPLATE_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such kind of email."),

	TEMPLATE_NOT_EDITABLE("NOTIFICATION_TEMPLATE_NOT_EDITABLE", ErrorCategory.CONFLICT,
			"This kind of email is written in full each time it is sent and has no template."),

	TEMPLATE_INVALID("NOTIFICATION_TEMPLATE_INVALID", ErrorCategory.VALIDATION,
			"The template uses a variable this email does not offer, leaves out one it needs, or is not valid."),

	TEMPLATE_CHANGED("NOTIFICATION_TEMPLATE_CHANGED", ErrorCategory.CONFLICT,
			"Someone changed this template since you opened it. Reload and try again."),

	MESSAGE_NOT_FOUND("NOTIFICATION_MESSAGE_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such email."),

	MESSAGE_NOT_RESENDABLE("NOTIFICATION_MESSAGE_NOT_RESENDABLE", ErrorCategory.CONFLICT,
			"This email cannot be sent again: a sign-in code is asked for again on the sign-in screen."),

	ADDRESS_SUPPRESSED("NOTIFICATION_ADDRESS_SUPPRESSED", ErrorCategory.CONFLICT,
			"BeyondPilot does not send to this address. Remove it from Suppressions first."),

	SUPPRESSION_NOT_FOUND("NOTIFICATION_SUPPRESSION_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"This address is not suppressed."),

	SUPPRESSION_EXISTS("NOTIFICATION_SUPPRESSION_EXISTS", ErrorCategory.CONFLICT, "This address is already suppressed.");

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
