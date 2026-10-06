package ai.genaifund.beyondpilot.program;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum ProgramErrorCode implements ErrorCode {

	PROGRAM_NOT_FOUND("PROGRAM_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such program."),

	SLUG_TAKEN("PROGRAM_SLUG_TAKEN", ErrorCategory.CONFLICT, "Another program already has this address."),

	SLUG_FIXED("PROGRAM_SLUG_FIXED", ErrorCategory.CONFLICT,
			"The address cannot change once the program has been published."),

	QUESTIONS_FIXED("PROGRAM_QUESTIONS_FIXED", ErrorCategory.CONFLICT,
			"The applications have opened, so the questions can no longer change."),

	CHOICES_REQUIRED("PROGRAM_CHOICES_REQUIRED", ErrorCategory.VALIDATION,
			"A question answered by a choice offers two to twenty choices."),

	CHANGED_MEANWHILE("PROGRAM_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"Someone else saved this program in the meantime. Reload it and make your changes again."),

	DAYS_OUT_OF_ORDER("PROGRAM_DAYS_OUT_OF_ORDER", ErrorCategory.VALIDATION,
			"The program ends before it starts."),

	WINDOW_OUT_OF_ORDER("PROGRAM_WINDOW_OUT_OF_ORDER", ErrorCategory.VALIDATION,
			"Applications close before they open."),

	OUTCOMES_BEFORE_CLOSE("PROGRAM_OUTCOMES_BEFORE_CLOSE", ErrorCategory.VALIDATION,
			"Outcomes are due before applications close."),

	KEY_DATE_OUT_OF_ORDER("PROGRAM_KEY_DATE_OUT_OF_ORDER", ErrorCategory.VALIDATION,
			"A key date ends before it starts."),

	EVENT_OUT_OF_ORDER("PROGRAM_EVENT_OUT_OF_ORDER", ErrorCategory.VALIDATION, "An event ends before it starts."),

	EXTERNAL_URL_REQUIRED("PROGRAM_EXTERNAL_URL_REQUIRED", ErrorCategory.VALIDATION,
			"A program whose page is somewhere else needs the address of that page."),

	NOT_READY_TO_PUBLISH("PROGRAM_NOT_READY_TO_PUBLISH", ErrorCategory.VALIDATION,
			"This program cannot be published yet. Fill in what the Settings screen lists, then publish it."),

	COVER_NOT_USABLE("PROGRAM_COVER_NOT_USABLE", ErrorCategory.VALIDATION,
			"This file cannot be the cover. Upload the image again.");

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
