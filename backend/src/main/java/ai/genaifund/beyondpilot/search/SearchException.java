package ai.genaifund.beyondpilot.search;

import ai.genaifund.beyondpilot.BusinessException;

public final class SearchException extends BusinessException {

	SearchException(SearchErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}

}
