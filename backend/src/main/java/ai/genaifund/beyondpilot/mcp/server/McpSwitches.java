package ai.genaifund.beyondpilot.mcp.server;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import ai.genaifund.beyondpilot.identity.McpAudience;
import ai.genaifund.beyondpilot.mcp.persistence.McpSwitchRepository;
import io.modelcontextprotocol.server.McpStatelessServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

/**
 * The switches operators set in Admin › AI › MCP › Tools, applied to the running servers: a tool switched off leaves
 * its server's {@code tools/list} and is refused if an app still calls it; the user server switched off answers 404.
 * The switches are read once at start and kept in memory, changed only through here; BeyondPilot runs one instance.
 */
public class McpSwitches {

	private static final String USER_SERVER = "user";

	private final Map<McpAudience, McpStatelessSyncServer> servers;

	private final Map<McpAudience, List<SyncToolSpecification>> tools;

	private final McpSwitchRepository stored;

	private final Map<String, Boolean> state = new ConcurrentHashMap<>();

	McpSwitches(Map<McpAudience, McpStatelessSyncServer> servers, Map<McpAudience, List<SyncToolSpecification>> tools,
			McpSwitchRepository stored) {
		this.servers = servers;
		this.tools = tools;
		this.stored = stored;
	}

	@EventListener(ApplicationReadyEvent.class)
	void apply() {
		state.putAll(stored.all());
		tools.forEach((server, specifications) -> specifications.forEach(tool -> applyTo(server, tool)));
	}

	/** The tools of a server, as their specifications say, each with its switch. */
	public List<Switched> tools(McpAudience server) {
		return tools.get(server).stream().map(tool -> new Switched(server, tool, isOn(server, tool.tool().name()))).toList();
	}

	public boolean isUserServerOn() {
		return state.getOrDefault(USER_SERVER, true);
	}

	/** Turns the user server on or off. @return whether it changed */
	public synchronized boolean userServer(boolean on) {
		if (isUserServerOn() == on) {
			return false;
		}
		stored.set(USER_SERVER, on);
		state.put(USER_SERVER, on);
		return true;
	}

	/**
	 * Turns a tool on or off.
	 * @return whether it changed
	 * @throws IllegalArgumentException when the server has no such tool
	 */
	public synchronized boolean tool(McpAudience server, String name, boolean on) {
		SyncToolSpecification tool = tools.get(server)
			.stream()
			.filter(candidate -> candidate.tool().name().equals(name))
			.findFirst()
			.orElseThrow(() -> new IllegalArgumentException("No such tool"));
		if (isOn(server, name) == on) {
			return false;
		}
		stored.set(key(server, name), on);
		state.put(key(server, name), on);
		applyTo(server, tool);
		return true;
	}

	private void applyTo(McpAudience server, SyncToolSpecification tool) {
		McpStatelessSyncServer running = servers.get(server);
		boolean listed = running.listTools().stream().anyMatch(listedTool -> listedTool.name().equals(tool.tool().name()));
		boolean on = isOn(server, tool.tool().name());
		if (on && !listed) {
			running.addTool(tool);
		}
		else if (!on && listed) {
			running.removeTool(tool.tool().name());
		}
	}

	private boolean isOn(McpAudience server, String tool) {
		return state.getOrDefault(key(server, tool), true);
	}

	private static String key(McpAudience server, String tool) {
		return server.name().toLowerCase(Locale.ROOT) + "." + tool;
	}

	/** A tool of a server, and whether it is on. */
	public record Switched(McpAudience server, SyncToolSpecification tool, boolean on) {
	}

}
