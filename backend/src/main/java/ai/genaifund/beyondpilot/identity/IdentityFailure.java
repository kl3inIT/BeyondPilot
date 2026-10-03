package ai.genaifund.beyondpilot.identity;

import ai.genaifund.beyondpilot.FailureCategory;
import ai.genaifund.beyondpilot.FailureReason;

public enum IdentityFailure implements FailureReason {

	ACCOUNT_DISABLED("IDENTITY_ACCOUNT_DISABLED", FailureCategory.NOT_PERMITTED, "This account has been disabled."),
	EMAIL_NOT_VERIFIED("IDENTITY_EMAIL_NOT_VERIFIED", FailureCategory.NOT_PERMITTED,
			"The email address of this account is not verified by its provider.");

	private final String code;
	private final FailureCategory category;
	private final String message;

	IdentityFailure(String code, FailureCategory category, String message) {
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
