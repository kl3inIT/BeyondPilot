package ai.genaifund.beyondpilot.program;

import ai.genaifund.beyondpilot.BusinessException;

public final class ProgramException extends BusinessException {

	ProgramException(ProgramErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}

	ProgramException(ProgramErrorCode errorCode, String diagnosticMessage, Throwable cause) {
		super(errorCode, diagnosticMessage, cause);
	}
}
