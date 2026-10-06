package ai.genaifund.beyondpilot.search;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum SearchErrorCode implements ErrorCode {

	PROVIDER_NOT_FOUND("SEARCH_PROVIDER_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such AI provider."),

	PROVIDER_INVALID("SEARCH_PROVIDER_INVALID", ErrorCategory.VALIDATION,
			"The address must be the provider's own API address."),

	PROVIDER_NAME_TAKEN("SEARCH_PROVIDER_NAME_TAKEN", ErrorCategory.CONFLICT,
			"Another provider already has this name."),

	PROVIDER_CHANGED("SEARCH_PROVIDER_CHANGED", ErrorCategory.CONFLICT,
			"Someone changed this provider since you opened it. Reload and try again."),

	PROVIDER_IN_USE("SEARCH_PROVIDER_IN_USE", ErrorCategory.CONFLICT,
			"Search embeds with this provider. Change the model to another provider first."),

	PROVIDER_KEY_MISSING("SEARCH_PROVIDER_KEY_MISSING", ErrorCategory.VALIDATION,
			"The provider has no API key. Enter one, or keep the saved key with the same address."),

	MODEL_UNKNOWN("SEARCH_MODEL_UNKNOWN", ErrorCategory.VALIDATION, "This provider does not offer that model."),

	MODEL_REJECTED("SEARCH_MODEL_REJECTED", ErrorCategory.VALIDATION,
			"The provider did not embed a test sentence with this key and model. Test the connection to see why."),

	RETRY_ITEM_INCOMPLETE("SEARCH_RETRY_ITEM_INCOMPLETE", ErrorCategory.VALIDATION,
			"Name the kind of the item to try again, or neither to try every item again."),

	SETTINGS_CHANGED("SEARCH_SETTINGS_CHANGED", ErrorCategory.CONFLICT,
			"Someone changed the search settings since you opened them. Reload and try again."),

	ENCRYPTION_KEY_MISSING("SEARCH_ENCRYPTION_KEY_MISSING", ErrorCategory.SERVICE_UNAVAILABLE,
			"Keys cannot be stored: the server has no encryption key for them.");

	private final String code;

	private final ErrorCategory category;

	private final String message;

	SearchErrorCode(String code, ErrorCategory category, String message) {
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
