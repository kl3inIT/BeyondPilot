package ai.genaifund.beyondpilot.talent;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum TalentErrorCode implements ErrorCode {

	PROFILE_NOT_FOUND("TALENT_PROFILE_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such talent profile."),

	INCOMPLETE("TALENT_INCOMPLETE", ErrorCategory.VALIDATION,
			"A talent profile needs a headline, a bio, a role and a skill before it is submitted."),

	NOT_SUBMITTABLE("TALENT_NOT_SUBMITTABLE", ErrorCategory.CONFLICT,
			"This talent profile is already submitted or approved."),

	NOT_AWAITING_REVIEW("TALENT_NOT_AWAITING_REVIEW", ErrorCategory.CONFLICT,
			"This talent profile is not waiting for review."),

	CHANGED_MEANWHILE("TALENT_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"This talent profile was saved somewhere else in the meantime. Reload it and make your changes again."),

	OWN_PROFILE("TALENT_OWN_PROFILE", ErrorCategory.CONFLICT, "You cannot send a message to your own profile."),

	ENQUIRY_TOO_SOON("TALENT_ENQUIRY_TOO_SOON", ErrorCategory.LIMIT_EXCEEDED,
			"You already sent this person a message today. Wait for their answer, or write again tomorrow.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	TalentErrorCode(String code, ErrorCategory category, String message) {
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
