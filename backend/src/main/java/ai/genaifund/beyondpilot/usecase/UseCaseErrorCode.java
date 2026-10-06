package ai.genaifund.beyondpilot.usecase;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum UseCaseErrorCode implements ErrorCode {

	NOT_FOUND("USECASE_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such use case."),

	ORGANIZATION_NOT_ELIGIBLE("USECASE_ORGANIZATION_NOT_ELIGIBLE", ErrorCategory.VALIDATION,
			"Only an approved organization can have a use case. Choose another organization."),

	CLOSES_IN_THE_PAST("USECASE_CLOSES_IN_THE_PAST", ErrorCategory.VALIDATION,
			"The date proposals stop must be in the future."),

	BUDGET_INCOMPLETE("USECASE_BUDGET_INCOMPLETE", ErrorCategory.VALIDATION,
			"Give a minimum and a maximum budget, or mark the budget as to be determined."),

	BUDGET_OUT_OF_ORDER("USECASE_BUDGET_OUT_OF_ORDER", ErrorCategory.VALIDATION,
			"The minimum budget is above the maximum."),

	ENTERPRISE_REQUIRED("USECASE_ENTERPRISE_REQUIRED", ErrorCategory.NOT_PERMITTED,
			"Only the members of an approved organization can write its use cases."),

	CHANGED_MEANWHILE("USECASE_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"Someone saved this use case in the meantime. Reload it and make your changes again."),

	NOT_EDITABLE("USECASE_NOT_EDITABLE", ErrorCategory.CONFLICT,
			"This use case cannot be edited now: it waits for GenAI Fund, or its deadline has passed."),

	INCOMPLETE("USECASE_INCOMPLETE", ErrorCategory.VALIDATION,
			"Fill in every section before sending the use case for review."),

	NOT_SUBMITTABLE("USECASE_NOT_SUBMITTABLE", ErrorCategory.CONFLICT,
			"Only a draft, or a use case GenAI Fund sent back, can be sent for review."),

	CANNOT_MOVE_TO_DRAFT("USECASE_CANNOT_MOVE_TO_DRAFT", ErrorCategory.CONFLICT,
			"Only a use case in review or published can be moved back to a draft."),

	NOT_AWAITING_REVIEW("USECASE_NOT_AWAITING_REVIEW", ErrorCategory.CONFLICT,
			"Only a use case in review can be approved or sent back."),

	ATTACHMENT_NOT_USABLE("USECASE_ATTACHMENT_NOT_USABLE", ErrorCategory.VALIDATION,
			"An attachment is not a file you uploaded for a use case, or it is attached to another use case."),

	TIMELINE_OUT_OF_ORDER("USECASE_TIMELINE_OUT_OF_ORDER", ErrorCategory.VALIDATION,
			"The shortest timeline is longer than the longest.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	UseCaseErrorCode(String code, ErrorCategory category, String message) {
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
