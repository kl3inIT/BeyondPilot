package ai.genaifund.beyondpilot.mcp.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The log of calls to the MCP servers: one row a call, without its arguments or results. */
@Repository
public class McpCallRepository {

	private final JdbcClient jdbc;

	McpCallRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public void record(Call call) {
		jdbc.sql("""
				insert into mcp_call (id, called_at, account_id, client_id, server, tool, outcome, duration_ms)
				values (:id, :at, :account, :client, :server, :tool, :outcome, :duration)
				""")
			.param("id", UUID.randomUUID())
			.param("at", OffsetDateTime.ofInstant(call.calledAt(), ZoneOffset.UTC))
			.param("account", call.accountId())
			.param("client", call.clientId())
			.param("server", call.server())
			.param("tool", call.tool())
			.param("outcome", call.outcome())
			.param("duration", call.durationMs())
			.update();
	}

	/**
	 * Deletes the calls made before this instant.
	 * @return how many were deleted
	 */
	public int deleteBefore(Instant before) {
		return jdbc.sql("delete from mcp_call where called_at < :before")
			.param("before", OffsetDateTime.ofInstant(before, ZoneOffset.UTC))
			.update();
	}

	/**
	 * One call.
	 * @param server {@code user} or {@code operator}
	 * @param outcome {@code ok}, {@code refused} (the tool answered with an error, such as an unknown id) or
	 * {@code failed} (it broke)
	 */
	public record Call(Instant calledAt, UUID accountId, String clientId, String server, String tool, String outcome,
			int durationMs) {
	}

}
