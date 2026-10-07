package ai.genaifund.beyondpilot.mcp.persistence;

import java.util.HashMap;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The switches of the MCP servers: {@code user} for the user server, {@code server.tool} for a tool. */
@Repository
public class McpSwitchRepository {

	private final JdbcClient jdbc;

	McpSwitchRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Every switch that was ever set; one not here is on. */
	public Map<String, Boolean> all() {
		Map<String, Boolean> switches = new HashMap<>();
		jdbc.sql("select name, enabled from mcp_switch")
			.query((row, number) -> switches.put(row.getString("name"), row.getBoolean("enabled")))
			.list();
		return switches;
	}

	public void set(String name, boolean enabled) {
		jdbc.sql("""
				insert into mcp_switch (name, enabled) values (:name, :enabled)
				on conflict (name) do update set enabled = excluded.enabled, changed_at = now()
				""").param("name", name).param("enabled", enabled).update();
	}

}
