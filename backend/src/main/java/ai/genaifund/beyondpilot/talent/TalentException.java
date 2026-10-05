package ai.genaifund.beyondpilot.talent;

import ai.genaifund.beyondpilot.BusinessException;

public final class TalentException extends BusinessException {

	TalentException(TalentErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
