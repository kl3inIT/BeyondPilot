package ai.genaifund.beyondpilot.notification;

import ai.genaifund.beyondpilot.BusinessException;

public final class NotificationException extends BusinessException {

	NotificationException(NotificationErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}

}
