package ai.genaifund.beyondpilot.solution;

import ai.genaifund.beyondpilot.BusinessException;

public final class SolutionException extends BusinessException {

	SolutionException(SolutionErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
