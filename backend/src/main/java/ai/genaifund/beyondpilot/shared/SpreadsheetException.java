package ai.genaifund.beyondpilot.shared;

import ai.genaifund.beyondpilot.BusinessException;

public final class SpreadsheetException extends BusinessException {

	SpreadsheetException(SpreadsheetErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}

}
