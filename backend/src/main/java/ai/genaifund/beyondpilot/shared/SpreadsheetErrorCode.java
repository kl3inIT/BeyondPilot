package ai.genaifund.beyondpilot.shared;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum SpreadsheetErrorCode implements ErrorCode {

	TOO_LARGE("SPREADSHEET_TOO_LARGE", ErrorCategory.VALIDATION,
			"This list holds more rows than a download takes. Narrow it with the filters and download again.");

	private final String code;

	private final ErrorCategory category;

	private final String message;

	SpreadsheetErrorCode(String code, ErrorCategory category, String message) {
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
