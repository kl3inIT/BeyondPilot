package ai.genaifund.beyondpilot.identity.oauth;

import java.util.Set;

/** The scopes an AI app may hold: one per MCP server, and the refresh of its connection. */
final class McpScopes {

	/** Reads what BeyondPilot publishes, on {@code /mcp}. */
	static final String READ = "mcp.read";

	/** The operators' tools, on {@code /mcp/operator}; granted to operators only. */
	static final String RESEARCH = "mcp.research";

	/** Asked for by clients that refresh; every connection refreshes, so it grants nothing more. */
	static final String OFFLINE_ACCESS = "offline_access";

	static final Set<String> ALL = Set.of(READ, RESEARCH, OFFLINE_ACCESS);

	private McpScopes() {
	}

}
