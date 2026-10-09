package ai.genaifund.beyondpilot.identity;

/**
 * A call to an MCP server that may not proceed. The server answers as RFC 6750 says: {@code invalid_token} with 401,
 * for a token that is not one of BeyondPilot's for that server or a connection, account or role that no longer stands;
 * {@code insufficient_scope} with 403, for a token without the server's scope.
 */
public final class McpCallRefused extends RuntimeException {

	private final boolean insufficientScope;

	McpCallRefused(String reason, boolean insufficientScope) {
		super(reason);
		this.insufficientScope = insufficientScope;
	}

	/** Whether the token lacks the server's scope, rather than not working at all. */
	public boolean insufficientScope() {
		return insufficientScope;
	}

}
