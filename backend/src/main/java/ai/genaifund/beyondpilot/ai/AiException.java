package ai.genaifund.beyondpilot.ai;

import ai.genaifund.beyondpilot.BusinessException;

public final class AiException extends BusinessException {

	private final AiErrorCode errorCode;

	AiException(AiErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
		this.errorCode = errorCode;
	}

	/** Which refusal this is, for a module that words it in its own terms. */
	public AiErrorCode errorCode() {
		return errorCode;
	}

}
