package ai.genaifund.beyondpilot.storage;

import ai.genaifund.beyondpilot.BusinessException;

public final class StorageException extends BusinessException {

	StorageException(StorageErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
