package ai.genaifund.beyondpilot.notification;

import ai.genaifund.beyondpilot.BusinessException;

public final class NotificationException extends BusinessException {

	NotificationException(NotificationFailure failure, String diagnosticMessage, Throwable cause) {
		super(failure, diagnosticMessage, cause);
	}
}
