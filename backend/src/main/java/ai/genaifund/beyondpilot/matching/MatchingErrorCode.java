package ai.genaifund.beyondpilot.matching;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum MatchingErrorCode implements ErrorCode {

	USE_CASE_NOT_FOUND("MATCHING_USE_CASE_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such use case."),
	CANDIDATE_NOT_FOUND("MATCHING_CANDIDATE_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such candidate."),
	SOLUTION_NOT_FOUND("MATCHING_SOLUTION_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such approved solution."),
	OPERATORS_ONLY("MATCHING_OPERATORS_ONLY", ErrorCategory.NOT_PERMITTED, "Only GenAI Fund can do this."),
	NO_MODEL("MATCHING_NO_MODEL", ErrorCategory.SERVICE_UNAVAILABLE,
			"Matching cannot run now: no AI model is set for it."),
	RUN_OPEN("MATCHING_RUN_OPEN", ErrorCategory.CONFLICT, "Matching is already running for this use case."),
	RUN_LIMIT("MATCHING_RUN_LIMIT", ErrorCategory.LIMIT_EXCEEDED,
			"Matching was run as often as a day allows for this use case. Try again tomorrow."),
	CANDIDATE_REMOVED("MATCHING_CANDIDATE_REMOVED", ErrorCategory.CONFLICT,
			"This candidate was removed. Restore it first."),
	REMOVED_BY_OPERATOR("MATCHING_REMOVED_BY_OPERATOR", ErrorCategory.NOT_PERMITTED,
			"GenAI Fund removed this candidate; only GenAI Fund can restore it."),
	ALREADY_CANDIDATE("MATCHING_ALREADY_CANDIDATE", ErrorCategory.CONFLICT,
			"This solution is already a candidate for this use case."),
	OWN_SOLUTION("MATCHING_OWN_SOLUTION", ErrorCategory.CONFLICT,
			"This solution belongs to the organization of the use case."),
	SETTINGS_CHANGED("MATCHING_SETTINGS_CHANGED", ErrorCategory.CONFLICT,
			"Someone else changed these settings. Reload and try again."),
	FEEDBACK_NOT_JUDGED("MATCHING_FEEDBACK_NOT_JUDGED", ErrorCategory.CONFLICT,
			"The AI has not read this candidate yet, so it has no group to answer about."),
	FEEDBACK_GROUP_INVALID("MATCHING_FEEDBACK_GROUP_INVALID", ErrorCategory.VALIDATION,
			"Agree with the group, or say which other group the candidate belongs in."),
	FEEDBACK_REQUIREMENT_UNKNOWN("MATCHING_FEEDBACK_REQUIREMENT_UNKNOWN", ErrorCategory.VALIDATION,
			"This use case has no such requirement.");

	private final String code;

	private final ErrorCategory category;

	private final String message;

	MatchingErrorCode(String code, ErrorCategory category, String message) {
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
