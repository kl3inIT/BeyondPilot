package ai.genaifund.beyondpilot.identity;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum IdentityErrorCode implements ErrorCode {

	ACCOUNT_DISABLED("IDENTITY_ACCOUNT_DISABLED", ErrorCategory.NOT_PERMITTED, "This account has been disabled."),
	EMAIL_NOT_VERIFIED("IDENTITY_EMAIL_NOT_VERIFIED", ErrorCategory.NOT_PERMITTED,
			"The email address of this account is not verified by its provider.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	IdentityErrorCode(String code, ErrorCategory category, String message) {
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
