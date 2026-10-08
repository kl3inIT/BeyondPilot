package ai.genaifund.beyondpilot.ai;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum AiErrorCode implements ErrorCode {

	PROVIDER_NOT_FOUND("AI_PROVIDER_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such AI provider."),

	PROVIDER_NAME_TAKEN("AI_PROVIDER_NAME_TAKEN", ErrorCategory.CONFLICT, "Another provider already has this name."),

	PROVIDER_CHANGED("AI_PROVIDER_CHANGED", ErrorCategory.CONFLICT,
			"Someone changed this provider since you opened it. Reload and try again."),

	PROVIDER_IN_USE("AI_PROVIDER_IN_USE", ErrorCategory.CONFLICT,
			"This provider is in use. Choose another one where it is used first."),

	PROVIDER_KEY_MISSING("AI_PROVIDER_KEY_MISSING", ErrorCategory.VALIDATION,
			"The provider has no API key. Enter one, or keep the saved key with the same address."),

	ENCRYPTION_KEY_MISSING("AI_ENCRYPTION_KEY_MISSING", ErrorCategory.SERVICE_UNAVAILABLE,
			"Keys cannot be stored: the server has no encryption key for them.");

	private final String code;

	private final ErrorCategory category;

	private final String message;

	AiErrorCode(String code, ErrorCategory category, String message) {
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
