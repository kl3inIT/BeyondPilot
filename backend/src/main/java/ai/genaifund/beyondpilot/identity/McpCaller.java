package ai.genaifund.beyondpilot.identity;

import java.util.UUID;

/**
 * The person behind a call to an MCP server, and the app they called through.
 * @param clientId the app's client ID: the address of its metadata document, or a client BeyondPilot registered
 * @param connectionId the connection the token belongs to, which the person can revoke
 */
public record McpCaller(UUID accountId, String clientId, String connectionId) {

	/** The caller as other modules' services take one. */
	public Actor actor() {
		return new Actor(accountId);
	}

}
