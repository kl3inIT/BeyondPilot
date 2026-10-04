package ai.genaifund.beyondpilot.program;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum ProgramErrorCode implements ErrorCode {

	PROGRAM_NOT_FOUND("PROGRAM_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such program."),

	SLUG_TAKEN("PROGRAM_SLUG_TAKEN", ErrorCategory.CONFLICT, "Another program already has this address.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	ProgramErrorCode(String code, ErrorCategory category, String message) {
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
