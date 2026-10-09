package ai.genaifund.beyondpilot.matching;

import ai.genaifund.beyondpilot.BusinessException;

public final class MatchingException extends BusinessException {

	MatchingException(MatchingErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}

}
