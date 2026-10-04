package ai.genaifund.beyondpilot.storage;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum StorageErrorCode implements ErrorCode {

	MEDIA_TYPE_NOT_ALLOWED("STORAGE_MEDIA_TYPE_NOT_ALLOWED", ErrorCategory.VALIDATION,
			"This kind of file cannot be uploaded here."),
	FILE_TOO_LARGE("STORAGE_FILE_TOO_LARGE", ErrorCategory.VALIDATION, "This file is larger than the limit."),
	UPLOAD_NOT_PERMITTED("STORAGE_UPLOAD_NOT_PERMITTED", ErrorCategory.NOT_PERMITTED,
			"You cannot upload this kind of file."),
	FILE_NOT_FOUND("STORAGE_FILE_NOT_FOUND", ErrorCategory.NOT_FOUND, "This file does not exist."),
	TICKET_REFUSED("STORAGE_TICKET_REFUSED", ErrorCategory.NOT_PERMITTED,
			"This upload address is not valid or has been used."),
	TICKET_EXPIRED("STORAGE_TICKET_EXPIRED", ErrorCategory.GONE, "This upload took too long. Start it again."),
	UPLOAD_MISSING("STORAGE_UPLOAD_MISSING", ErrorCategory.CONFLICT, "The file has not been uploaded yet."),
	CONTENT_MISMATCH("STORAGE_CONTENT_MISMATCH", ErrorCategory.VALIDATION,
			"The uploaded file is not the file that was announced.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	StorageErrorCode(String code, ErrorCategory category, String message) {
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
