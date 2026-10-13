package ai.genaifund.beyondpilot.messaging;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum MessagingErrorCode implements ErrorCode {

	CONVERSATION_NOT_FOUND("MESSAGING_CONVERSATION_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is no such conversation."),

	SUBJECT_NOT_FOUND("MESSAGING_SUBJECT_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"There is nobody to write to at this address."),

	OWN_SUBJECT("MESSAGING_OWN_SUBJECT", ErrorCategory.CONFLICT, "You cannot start a conversation with yourself."),

	NEEDS_ORGANIZATION("MESSAGING_NEEDS_ORGANIZATION", ErrorCategory.NOT_PERMITTED,
			"Create or join an organization before you write to a solution provider."),

	ORGANIZATION_NOT_APPROVED("MESSAGING_ORGANIZATION_NOT_APPROVED", ErrorCategory.NOT_PERMITTED,
			"Your organization has not been approved yet, so it cannot write to a solution provider."),

	ALREADY_WAITING("MESSAGING_ALREADY_WAITING", ErrorCategory.CONFLICT,
			"Your first message still waits for an answer. You can write again once it is accepted."),

	TOO_MANY_REQUESTS("MESSAGING_TOO_MANY_REQUESTS", ErrorCategory.LIMIT_EXCEEDED,
			"You started as many conversations as a day allows. Try again tomorrow."),

	TOO_MANY_MESSAGES("MESSAGING_TOO_MANY_MESSAGES", ErrorCategory.LIMIT_EXCEEDED,
			"You are writing too fast. Wait a moment and send again."),

	NOT_OPEN("MESSAGING_NOT_OPEN", ErrorCategory.CONFLICT,
			"This conversation is not open, so nothing can be written in it."),

	NOT_WAITING("MESSAGING_NOT_WAITING", ErrorCategory.CONFLICT, "This request was answered already."),

	OWNERS_ONLY("MESSAGING_OWNERS_ONLY", ErrorCategory.NOT_PERMITTED,
			"Only an owner of the organization answers a first message."),

	MESSAGE_CONFLICT("MESSAGING_MESSAGE_CONFLICT", ErrorCategory.CONFLICT,
			"This message could not be sent. Write it again.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	MessagingErrorCode(String code, ErrorCategory category, String message) {
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
