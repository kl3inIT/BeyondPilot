package ai.genaifund.beyondpilot.introduction;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum IntroductionErrorCode implements ErrorCode {

	SOLUTION_NOT_FOUND("INTRODUCTION_SOLUTION_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such solution."),

	NEEDS_ORGANIZATION("INTRODUCTION_NEEDS_ORGANIZATION", ErrorCategory.NOT_PERMITTED,
			"Create or join an organization before you ask for an introduction."),

	ORGANIZATION_NOT_APPROVED("INTRODUCTION_ORGANIZATION_NOT_APPROVED", ErrorCategory.NOT_PERMITTED,
			"Your organization has not been approved yet, so it cannot ask for an introduction."),

	OWN_SOLUTION("INTRODUCTION_OWN_SOLUTION", ErrorCategory.CONFLICT,
			"You cannot ask for an introduction to your own organization."),

	ALREADY_PENDING("INTRODUCTION_ALREADY_PENDING", ErrorCategory.CONFLICT,
			"You already asked for an introduction to this solution. Wait for the answer."),

	UNREACHABLE("INTRODUCTION_UNREACHABLE", ErrorCategory.SERVICE_UNAVAILABLE,
			"Nobody at this organization can be asked right now. Try again later."),

	REQUEST_NOT_FOUND("INTRODUCTION_REQUEST_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is no such request for an introduction."),

	OWNERS_ONLY("INTRODUCTION_OWNERS_ONLY", ErrorCategory.NOT_PERMITTED,
			"Only an owner of the organization answers a request for an introduction."),

	NOT_PENDING("INTRODUCTION_NOT_PENDING", ErrorCategory.CONFLICT, "This request was answered already.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	IntroductionErrorCode(String code, ErrorCategory category, String message) {
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
