package ai.genaifund.beyondpilot.mcp;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.McpAudience;
import ai.genaifund.beyondpilot.identity.McpCallers;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.mcp.dto.McpSettingsResponse;
import ai.genaifund.beyondpilot.mcp.server.McpSwitches;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators set in Admin › AI › MCP (BEY-78): the user server's switch and a switch per tool of either server.
 * Only an operator reads or changes them; every change is audited, a repeat changes and records nothing.
 */
@Service
public class McpAdministration {

	private static final String SETTING = "mcp_settings";

	private final McpSwitches switches;

	private final McpCallers callers;

	private final IdentityService identity;

	private final AuditTrail audit;

	McpAdministration(McpSwitches switches, McpCallers callers, IdentityService identity, AuditTrail audit) {
		this.switches = switches;
		this.callers = callers;
		this.identity = identity;
		this.audit = audit;
	}

	/** The servers' addresses, the user server's switch and every tool with its own. */
	@Transactional(readOnly = true)
	public McpSettingsResponse settings(Actor actor) {
		identity.requireOperator(actor);
		List<McpSettingsResponse.ToolSwitch> tools = Stream.of(McpAudience.OPERATOR, McpAudience.USER)
			.flatMap(server -> switches.tools(server).stream())
			.map(tool -> new McpSettingsResponse.ToolSwitch(serverName(tool.server()), tool.tool().tool().name(),
					tool.tool().tool().title(), tool.tool().tool().description(), tool.on()))
			.toList();
		return new McpSettingsResponse(callers.address(McpAudience.OPERATOR), callers.address(McpAudience.USER),
				switches.isUserServerOn(), tools);
	}

	@Transactional
	public void userServer(Actor actor, boolean enabled) {
		Operator operator = identity.requireOperator(actor);
		if (switches.userServer(enabled)) {
			record(enabled ? AuditAction.MCP_USER_SERVER_ENABLE : AuditAction.MCP_USER_SERVER_DISABLE, operator,
					"User MCP server");
		}
	}

	/**
	 * Turns a tool of a server on or off.
	 * @param server {@code user} or {@code operator}
	 * @throws McpException {@link McpErrorCode#TOOL_NOT_FOUND} when that server has no such tool
	 */
	@Transactional
	public void tool(Actor actor, String server, String tool, boolean enabled) {
		Operator operator = identity.requireOperator(actor);
		McpAudience audience = switch (server) {
			case "user" -> McpAudience.USER;
			case "operator" -> McpAudience.OPERATOR;
			default -> throw new McpException(McpErrorCode.TOOL_NOT_FOUND, "No such server");
		};
		boolean changed;
		try {
			changed = switches.tool(audience, tool, enabled);
		}
		catch (IllegalArgumentException unknown) {
			throw new McpException(McpErrorCode.TOOL_NOT_FOUND, "No such tool");
		}
		if (changed) {
			record(enabled ? AuditAction.MCP_TOOL_ENABLE : AuditAction.MCP_TOOL_DISABLE, operator, server + "." + tool);
		}
	}

	private static String serverName(McpAudience server) {
		return server.name().toLowerCase(Locale.ROOT);
	}

	private void record(AuditAction action, Operator operator, String label) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(SETTING, label, label), Map.of()));
	}

}
