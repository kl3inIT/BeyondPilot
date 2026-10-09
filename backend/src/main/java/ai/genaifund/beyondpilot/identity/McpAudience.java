package ai.genaifund.beyondpilot.identity;

/** The MCP server a token is for: each token works on one, with that server's scope. */
public enum McpAudience {

	/** {@code /mcp}, for every signed-in person. */
	USER("/mcp", "mcp.read"),

	/** {@code /mcp/operator}, for operators. */
	OPERATOR("/mcp/operator", "mcp.research");

	private final String path;

	private final String scope;

	McpAudience(String path, String scope) {
		this.path = path;
		this.scope = scope;
	}

	/** The server's path under the site's address. */
	public String path() {
		return path;
	}

	/** The scope a token must carry to call it. */
	public String scope() {
		return scope;
	}

}
