package ai.genaifund.beyondpilot.perk;

import ai.genaifund.beyondpilot.BusinessException;

public final class PerkException extends BusinessException {

	PerkException(PerkErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
