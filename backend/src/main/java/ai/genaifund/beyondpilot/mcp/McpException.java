package ai.genaifund.beyondpilot.mcp;

import ai.genaifund.beyondpilot.BusinessException;

public final class McpException extends BusinessException {

	McpException(McpErrorCode errorCode, String diagnosticMessage) {
		super(errorCode, diagnosticMessage);
	}
}
