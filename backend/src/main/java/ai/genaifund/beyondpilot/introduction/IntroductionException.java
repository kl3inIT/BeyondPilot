package ai.genaifund.beyondpilot.introduction;

import ai.genaifund.beyondpilot.BusinessException;

public final class IntroductionException extends BusinessException {

	IntroductionException(IntroductionErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
