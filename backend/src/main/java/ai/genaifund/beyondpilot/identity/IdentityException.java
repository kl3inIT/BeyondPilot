package ai.genaifund.beyondpilot.identity;

import ai.genaifund.beyondpilot.BusinessException;

public final class IdentityException extends BusinessException {

	IdentityException(IdentityErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
