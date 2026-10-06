package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum ProposalErrorCode implements ErrorCode {

	APPLICATION_NOT_FOUND("PROPOSAL_APPLICATION_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is no such application."),

	NOT_OPEN("PROPOSAL_NOT_OPEN", ErrorCategory.CONFLICT,
			"This program is not taking applications on BeyondPilot now."),

	CLOSED("PROPOSAL_CLOSED", ErrorCategory.CONFLICT,
			"Applications to this program have closed."),

	LOCKED("PROPOSAL_LOCKED", ErrorCategory.CONFLICT,
			"This application was submitted, and this program does not take changes after submission."),

	CHANGED_MEANWHILE("PROPOSAL_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"This application was saved somewhere else in the meantime. Reload it and make your changes again."),

	ALREADY_IN_ORGANIZATION("PROPOSAL_ALREADY_IN_ORGANIZATION", ErrorCategory.CONFLICT,
			"You already apply for an organization."),

	ORGANIZATION_REQUIRED("PROPOSAL_ORGANIZATION_REQUIRED", ErrorCategory.VALIDATION,
			"Say who applies: yourself, your team or your company."),

	ORGANIZATION_APPLIED("PROPOSAL_ORGANIZATION_APPLIED", ErrorCategory.CONFLICT,
			"Someone in your organization has already applied to this program."),

	CONTACT_INCOMPLETE("PROPOSAL_CONTACT_INCOMPLETE", ErrorCategory.VALIDATION,
			"Add your first and last name, your phone number, your country and your LinkedIn profile."),

	TEAM_BACKGROUND_REQUIRED("PROPOSAL_TEAM_BACKGROUND_REQUIRED", ErrorCategory.VALIDATION,
			"Describe your team's background."),

	SOLUTION_NOT_FOUND("PROPOSAL_SOLUTION_NOT_FOUND", ErrorCategory.VALIDATION,
			"Choose a solution of your organization."),

	SOLUTION_REQUIRED("PROPOSAL_SOLUTION_REQUIRED", ErrorCategory.VALIDATION,
			"Choose or add the solution you apply with."),

	SOLUTION_INCOMPLETE("PROPOSAL_SOLUTION_INCOMPLETE", ErrorCategory.VALIDATION,
			"The solution needs what it does, the problem it solves, its stage and a deck."),

	ANSWER_INVALID("PROPOSAL_ANSWER_INVALID", ErrorCategory.VALIDATION,
			"An answer does not fit its question."),

	ANSWER_REQUIRED("PROPOSAL_ANSWER_REQUIRED", ErrorCategory.VALIDATION,
			"Answer every question the program asks."),

	NOT_SUBMITTED("PROPOSAL_NOT_SUBMITTED", ErrorCategory.CONFLICT,
			"Only a submitted application can be withdrawn.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	ProposalErrorCode(String code, ErrorCategory category, String message) {
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
