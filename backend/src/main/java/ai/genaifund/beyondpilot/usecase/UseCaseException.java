package ai.genaifund.beyondpilot.usecase;

import ai.genaifund.beyondpilot.BusinessException;

public final class UseCaseException extends BusinessException {

	UseCaseException(UseCaseErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}

	UseCaseException(UseCaseErrorCode errorCode, String diagnosticMessage, Throwable cause) {
		super(errorCode, diagnosticMessage, cause);
	}
}
