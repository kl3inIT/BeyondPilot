package ai.genaifund.beyondpilot.identity;

import ai.genaifund.beyondpilot.BusinessException;

public final class IdentityException extends BusinessException {

	IdentityException(IdentityFailure failure, String diagnosticMessage) {
		super(failure, diagnosticMessage);
	}
}
