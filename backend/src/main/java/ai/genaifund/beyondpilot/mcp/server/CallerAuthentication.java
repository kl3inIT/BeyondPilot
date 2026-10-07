package ai.genaifund.beyondpilot.mcp.server;

import java.util.List;

import ai.genaifund.beyondpilot.identity.McpAudience;
import ai.genaifund.beyondpilot.identity.McpCaller;
import org.springframework.security.authentication.AbstractAuthenticationToken;

/** A call to an MCP server whose bearer token identity accepted: the person, their app and the server called. */
final class CallerAuthentication extends AbstractAuthenticationToken {

	private final McpCaller caller;

	private final McpAudience audience;

	CallerAuthentication(McpCaller caller, McpAudience audience) {
		super(List.of());
		this.caller = caller;
		this.audience = audience;
		setAuthenticated(true);
	}

	McpCaller caller() {
		return caller;
	}

	McpAudience audience() {
		return audience;
	}

	@Override
	public Object getCredentials() {
		return "";
	}

	@Override
	public Object getPrincipal() {
		return caller;
	}

	@Override
	public String getName() {
		return caller.accountId().toString();
	}

}
