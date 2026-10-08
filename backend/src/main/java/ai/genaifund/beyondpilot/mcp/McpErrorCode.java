package ai.genaifund.beyondpilot.mcp;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum McpErrorCode implements ErrorCode {

	TOOL_NOT_FOUND("MCP_TOOL_NOT_FOUND", ErrorCategory.NOT_FOUND, "This server has no such tool.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	McpErrorCode(String code, ErrorCategory category, String message) {
		this.code = code;
		this.category = category;
		this.message = message;
	}

	@Override
	public String code() {
		return code;
	}

	@Override
	public ErrorCategory category() {
		return category;
	}

	@Override
	public String message() {
		return message;
	}

}
