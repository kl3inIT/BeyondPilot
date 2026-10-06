package ai.genaifund.beyondpilot.solution;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum SolutionErrorCode implements ErrorCode {

	SOLUTION_NOT_FOUND("SOLUTION_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such solution."),

	MEMBER_REQUIRED("SOLUTION_MEMBER_REQUIRED", ErrorCategory.NOT_PERMITTED,
			"Only a member of an organization can do this."),

	ORGANIZATION_NOT_APPROVED("SOLUTION_ORGANIZATION_NOT_APPROVED", ErrorCategory.CONFLICT,
			"Approve the organization first: a solution is listed only when its organization is."),

	INCOMPLETE("SOLUTION_INCOMPLETE", ErrorCategory.VALIDATION,
			"A solution needs a summary, a maturity, a focus area, an industry, a logo and a cover image before it "
					+ "is submitted."),

	NOT_SUBMITTABLE("SOLUTION_NOT_SUBMITTABLE", ErrorCategory.CONFLICT,
			"This solution is already in review, approved, or refused for good."),

	NOT_A_DRAFT("SOLUTION_NOT_A_DRAFT", ErrorCategory.CONFLICT, "Only a draft can be deleted."),

	NOT_AWAITING_REVIEW("SOLUTION_NOT_AWAITING_REVIEW", ErrorCategory.CONFLICT,
			"This solution is not waiting for review."),

	NOT_APPROVED("SOLUTION_NOT_APPROVED", ErrorCategory.CONFLICT,
			"Only an approved solution that is not taken down can be taken down."),

	NOT_TAKEN_DOWN("SOLUTION_NOT_TAKEN_DOWN", ErrorCategory.CONFLICT, "This solution is not taken down."),

	CHANGED_MEANWHILE("SOLUTION_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"Someone else saved this solution in the meantime. Reload it and make your changes again."),

	DECK_NOT_USABLE("SOLUTION_DECK_NOT_USABLE", ErrorCategory.VALIDATION,
			"This file cannot be the deck: upload a PDF and use it for one solution only."),

	IMAGE_NOT_USABLE("SOLUTION_IMAGE_NOT_USABLE", ErrorCategory.VALIDATION,
			"This image cannot be used: upload a PNG, JPG or WebP for this solution and use it once."),
	DEPLOYMENT_NOT_FOUND("SOLUTION_DEPLOYMENT_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is no such customer deployment."),

	TOO_MANY_DEPLOYMENTS("SOLUTION_TOO_MANY_DEPLOYMENTS", ErrorCategory.CONFLICT,
			"A solution lists at most 12 customer deployments. Remove one before adding another."),

	DEPLOYMENT_NOT_AWAITING_REVIEW("SOLUTION_DEPLOYMENT_NOT_AWAITING_REVIEW", ErrorCategory.CONFLICT,
			"This customer deployment is not waiting for review."),

	DEPLOYMENT_CHANGED_MEANWHILE("SOLUTION_DEPLOYMENT_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"Someone else saved this customer deployment in the meantime. Reload it and make your changes again.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	SolutionErrorCode(String code, ErrorCategory category, String message) {
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
