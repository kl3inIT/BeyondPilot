package ai.genaifund.beyondpilot.identity;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum IdentityErrorCode implements ErrorCode {

	ACCOUNT_DISABLED("IDENTITY_ACCOUNT_DISABLED", ErrorCategory.NOT_PERMITTED, "This account has been disabled."),
	EMAIL_NOT_VERIFIED("IDENTITY_EMAIL_NOT_VERIFIED", ErrorCategory.NOT_PERMITTED,
			"The email address of this account is not verified by its provider."),

	OPERATOR_REQUIRED("IDENTITY_OPERATOR_REQUIRED", ErrorCategory.NOT_PERMITTED, "This needs the operator role."),

	ACCOUNT_NOT_FOUND("IDENTITY_ACCOUNT_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such account."),

	OWN_ACCOUNT("IDENTITY_OWN_ACCOUNT", ErrorCategory.CONFLICT,
			"An operator cannot disable their own account or withdraw their own role."),

	OPERATOR_CONFIGURED("IDENTITY_OPERATOR_CONFIGURED", ErrorCategory.CONFLICT,
			"This operator is named in the server configuration, which gives the role back at every sign-in.");

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
