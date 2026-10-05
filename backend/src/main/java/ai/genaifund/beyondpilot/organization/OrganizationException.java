package ai.genaifund.beyondpilot.organization;

import ai.genaifund.beyondpilot.BusinessException;

public final class OrganizationException extends BusinessException {

	OrganizationException(OrganizationErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
