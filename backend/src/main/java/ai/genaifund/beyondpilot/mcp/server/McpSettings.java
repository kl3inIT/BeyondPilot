package ai.genaifund.beyondpilot.mcp.server;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How the MCP servers take calls ({@code beyondpilot.mcp}).
 * @param callsPerCallerPerMinute how many calls one person makes through one app in a minute; a deep research run makes
 * a few dozen
 * @param callsPerMinute how many calls the servers take in a minute from everyone together
 * @param maxRequestBytes the largest request body; a JSON-RPC call is a few hundred bytes
 * @param callRetention how long the log of calls is kept
 */
@ConfigurationProperties("beyondpilot.mcp")
record McpSettings(@DefaultValue("300") int callsPerCallerPerMinute, @DefaultValue("3000") int callsPerMinute,
		@DefaultValue("262144") int maxRequestBytes, @DefaultValue("90d") Duration callRetention) {
}
