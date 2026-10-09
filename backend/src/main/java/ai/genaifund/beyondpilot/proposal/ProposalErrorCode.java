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

	WITHDRAWN_FOR_GOOD("PROPOSAL_WITHDRAWN_FOR_GOOD", ErrorCategory.CONFLICT,
			"This application was withdrawn, and this program takes no changes after submission, so it cannot be submitted again."),

	CHANGED_MEANWHILE("PROPOSAL_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"This application was saved somewhere else in the meantime. Reload it and make your changes again."),

	ALREADY_IN_ORGANIZATION("PROPOSAL_ALREADY_IN_ORGANIZATION", ErrorCategory.CONFLICT,
			"You already apply for an organization."),

	ORGANIZATION_REQUIRED("PROPOSAL_ORGANIZATION_REQUIRED", ErrorCategory.VALIDATION,
			"Say who applies: yourself, your team or your company."),

	ORGANIZATION_APPLIED("PROPOSAL_ORGANIZATION_APPLIED", ErrorCategory.CONFLICT,
			"Someone in your organization has already applied to this program."),

	CONTACT_INCOMPLETE("PROPOSAL_CONTACT_INCOMPLETE", ErrorCategory.VALIDATION,
			"Add your first and last name, your phone number and your country."),

	TEAM_BACKGROUND_REQUIRED("PROPOSAL_TEAM_BACKGROUND_REQUIRED", ErrorCategory.VALIDATION,
			"Describe your team's background."),

	SOLUTION_NOT_FOUND("PROPOSAL_SOLUTION_NOT_FOUND", ErrorCategory.VALIDATION,
			"Choose a solution of your organization."),

	SOLUTION_REQUIRED("PROPOSAL_SOLUTION_REQUIRED", ErrorCategory.VALIDATION,
			"Choose or add the solution you apply with."),

	SOLUTION_INCOMPLETE("PROPOSAL_SOLUTION_INCOMPLETE", ErrorCategory.VALIDATION,
			"The solution needs what it does, the problem it solves and its stage."),

	DECK_REQUIRED("PROPOSAL_DECK_REQUIRED", ErrorCategory.VALIDATION,
			"Add the solution's deck, a PDF."),

	ANSWER_INVALID("PROPOSAL_ANSWER_INVALID", ErrorCategory.VALIDATION,
			"An answer does not fit its question."),

	ANSWER_REQUIRED("PROPOSAL_ANSWER_REQUIRED", ErrorCategory.VALIDATION,
			"Answer every question the program asks."),

	NOT_SUBMITTED("PROPOSAL_NOT_SUBMITTED", ErrorCategory.CONFLICT,
			"Only a submitted application can be withdrawn."),

	REVIEW_PROGRAM_NOT_FOUND("PROPOSAL_REVIEW_PROGRAM_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is no such program taking applications."),

	OWN_APPLICATION("PROPOSAL_OWN_APPLICATION", ErrorCategory.NOT_PERMITTED,
			"You don't score or decide an application of your own or of your organization."),

	REVIEW_NOT_ALLOWED("PROPOSAL_REVIEW_NOT_ALLOWED", ErrorCategory.NOT_PERMITTED,
			"You do not review this program's applications."),

	CRITERIA_FIXED("PROPOSAL_CRITERIA_FIXED", ErrorCategory.CONFLICT,
			"Applications have been scored on these criteria, so they can no longer change."),

	CRITERIA_INVALID("PROPOSAL_CRITERIA_INVALID", ErrorCategory.VALIDATION,
			"Give each criterion its own name."),

	NO_CRITERIA("PROPOSAL_NO_CRITERIA", ErrorCategory.CONFLICT,
			"This program has no judging criteria yet."),

	REVIEWER_INVITED("PROPOSAL_REVIEWER_INVITED", ErrorCategory.CONFLICT,
			"This address is already invited to judge this program."),

	REVIEWER_NOT_FOUND("PROPOSAL_REVIEWER_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is no such judge of this program."),

	REVIEWER_JOINED("PROPOSAL_REVIEWER_JOINED", ErrorCategory.CONFLICT,
			"This judge has already signed in; there is no invitation to send again."),

	ASSESSMENT_INVALID("PROPOSAL_ASSESSMENT_INVALID", ErrorCategory.VALIDATION,
			"Score every criterion from 1 to 5, or declare a conflict."),

	RELEASED("PROPOSAL_RELEASED", ErrorCategory.CONFLICT,
			"The outcomes of this program have been released, so the review can no longer change."),

	OUTCOMES_NOT_READY("PROPOSAL_OUTCOMES_NOT_READY", ErrorCategory.CONFLICT,
			"Outcomes are released once applications have closed and every application has a decision.");

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
