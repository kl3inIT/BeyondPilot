package ai.genaifund.beyondpilot.perk;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum PerkErrorCode implements ErrorCode {

	NOT_FOUND("PERK_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such perk."),

	ORGANIZATION_NOT_FOUND("PERK_ORGANIZATION_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is no such organization to give the perk."),

	MEMBER_REQUIRED("PERK_MEMBER_REQUIRED", ErrorCategory.NOT_PERMITTED,
			"Only a member of an organization on BeyondPilot can do this."),

	ARRANGED("PERK_ARRANGED", ErrorCategory.NOT_PERMITTED,
			"GenAI Fund arranged this perk, so only GenAI Fund changes, archives or deletes it."),

	CHANGED_MEANWHILE("PERK_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"Someone else saved this perk in the meantime. Reload it and make your changes again."),

	TITLE_TAKEN("PERK_TITLE_TAKEN", ErrorCategory.CONFLICT,
			"Another perk of the organization already reads the same. Name this one differently."),

	PROGRAM_NOT_FOUND("PERK_PROGRAM_NOT_FOUND", ErrorCategory.VALIDATION,
			"Choose the program whose teams may get it."),

	DATES_NOT_VALID("PERK_DATES_NOT_VALID", ErrorCategory.VALIDATION, "A perk ends after it starts."),

	QUESTIONS_NOT_VALID("PERK_QUESTIONS_NOT_VALID", ErrorCategory.VALIDATION,
			"Each question of a perk is asked once. Reload the form and try again."),

	SOLUTION_NOT_USABLE("PERK_SOLUTION_NOT_USABLE", ErrorCategory.VALIDATION,
			"A perk goes only with solutions of the organization that gives it."),

	PAGE_REQUIRED("PERK_PAGE_REQUIRED", ErrorCategory.VALIDATION,
			"A published perk goes with a solution of its organization, or shows on a program's page."),

	INCOMPLETE("PERK_INCOMPLETE", ErrorCategory.VALIDATION,
			"A perk needs what its way of getting it asks for: its link or its code, and codes in its list before it is published."),

	IN_USE("PERK_IN_USE", ErrorCategory.CONFLICT,
			"Teams have already got this perk. Archive it instead, which keeps what they got."),

	NOT_AVAILABLE("PERK_NOT_AVAILABLE", ErrorCategory.CONFLICT,
			"This perk is not available now: it has not started, has ended, or is no longer published."),

	ORGANIZATION_REQUIRED("PERK_ORGANIZATION_REQUIRED", ErrorCategory.NOT_PERMITTED,
			"A perk is got for an organization. Create or join one first."),

	NOT_ELIGIBLE("PERK_NOT_ELIGIBLE", ErrorCategory.NOT_PERMITTED, "This perk is for other teams."),

	NO_PLACES_LEFT("PERK_NO_PLACES_LEFT", ErrorCategory.CONFLICT, "Every place of this perk has been taken."),

	ANSWERS_NOT_VALID("PERK_ANSWERS_NOT_VALID", ErrorCategory.VALIDATION,
			"Answer every required question, each within its length."),

	NOT_A_CODE_LIST("PERK_NOT_A_CODE_LIST", ErrorCategory.CONFLICT,
			"Codes are loaded only for a perk given as a list of codes."),

	REQUEST_NOT_FOUND("PERK_REQUEST_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such request."),

	REQUEST_DECIDED("PERK_REQUEST_DECIDED", ErrorCategory.CONFLICT,
			"Someone else has decided this request in the meantime. Reload the list.");

	private final String code;

	private final ErrorCategory category;

	private final String message;

	PerkErrorCode(String code, ErrorCategory category, String message) {
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
