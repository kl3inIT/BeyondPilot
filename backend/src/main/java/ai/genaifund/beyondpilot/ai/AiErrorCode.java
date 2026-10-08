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
			"Keys cannot be stored: the server has no encryption key for them."),

	PROVIDER_ENDPOINT_INVALID("AI_PROVIDER_ENDPOINT_INVALID", ErrorCategory.VALIDATION,
			"The address must be an http or https URL, not link-local, without credentials, a query or a fragment."),

	PROVIDER_ADAPTER_UNKNOWN("AI_PROVIDER_ADAPTER_UNKNOWN", ErrorCategory.VALIDATION,
			"BeyondPilot does not speak this provider's API."),

	PROVIDER_CREDENTIAL_REJECTED("AI_PROVIDER_CREDENTIAL_REJECTED", ErrorCategory.VALIDATION,
			"The provider rejected the API key."),

	PROVIDER_UNREACHABLE("AI_PROVIDER_UNREACHABLE", ErrorCategory.SERVICE_UNAVAILABLE,
			"The provider could not be reached before the timeout."),

	PROVIDER_INCOMPATIBLE("AI_PROVIDER_INCOMPATIBLE", ErrorCategory.VALIDATION,
			"The provider did not answer as its API should."),

	MODEL_NOT_FOUND("AI_MODEL_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such model."),

	MODEL_NAME_TAKEN("AI_MODEL_NAME_TAKEN", ErrorCategory.CONFLICT, "This provider already has that model."),

	MODEL_CHANGED("AI_MODEL_CHANGED", ErrorCategory.CONFLICT,
			"Someone changed this model since you opened it. Reload and try again."),

	MODEL_INVALID("AI_MODEL_INVALID", ErrorCategory.VALIDATION,
			"The answer limit must be smaller than the context window."),

	MODEL_UNAVAILABLE("AI_MODEL_UNAVAILABLE", ErrorCategory.VALIDATION,
			"This model cannot be used: its provider is switched off or has no key."),

	TASK_UNKNOWN("AI_TASK_UNKNOWN", ErrorCategory.NOT_FOUND, "There is no such task."),

	TASK_CHANGED("AI_TASK_CHANGED", ErrorCategory.CONFLICT,
			"Someone changed this task's model since you opened it. Reload and try again."),

	TASK_NOT_CONFIGURED("AI_TASK_NOT_CONFIGURED", ErrorCategory.SERVICE_UNAVAILABLE,
			"No model is chosen for this task, or its provider cannot be used."),

	BUSY("AI_BUSY", ErrorCategory.SERVICE_UNAVAILABLE, "Too many models are in use at once. Try again in a moment.");

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
