package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.BusinessException;

public final class ProposalException extends BusinessException {

	ProposalException(ProposalErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
