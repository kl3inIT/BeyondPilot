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

	NOT_APPROVED("TALENT_NOT_APPROVED", ErrorCategory.CONFLICT,
			"Only an approved talent profile that is not taken down can be taken down."),

	NOT_TAKEN_DOWN("TALENT_NOT_TAKEN_DOWN", ErrorCategory.CONFLICT,
			"Only an approved profile that is taken down can be restored; one sent again after a takedown waits for "
					+ "review."),

	PHOTO_NOT_USABLE("TALENT_PHOTO_NOT_USABLE", ErrorCategory.VALIDATION,
			"Upload the photo again: this file cannot be used as the photo of your profile."),

	CHANGED_MEANWHILE("TALENT_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"This talent profile was saved somewhere else in the meantime. Reload it and make your changes again."),

	OWN_PROFILE("TALENT_OWN_PROFILE", ErrorCategory.CONFLICT, "You cannot send a message to your own profile."),

	ENQUIRY_PENDING("TALENT_ENQUIRY_PENDING", ErrorCategory.CONFLICT,
			"Your message to this person waits for their answer. You can write again once they answer or it closes."),

	ENQUIRY_LIMIT("TALENT_ENQUIRY_LIMIT", ErrorCategory.LIMIT_EXCEEDED,
			"You started ten conversations today. Write again tomorrow."),

	ENQUIRY_NOT_FOUND("TALENT_ENQUIRY_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such message."),

	ENQUIRY_NOT_PENDING("TALENT_ENQUIRY_NOT_PENDING", ErrorCategory.CONFLICT,
			"This message was answered already, or it closed.");

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
