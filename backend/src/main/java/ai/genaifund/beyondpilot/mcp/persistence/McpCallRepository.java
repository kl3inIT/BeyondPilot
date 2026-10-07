package ai.genaifund.beyondpilot.mcp.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
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

	/** One page of the calls the filter keeps, newest first. */
	public List<LoggedCall> page(Filter filter, int limit, long offset) {
		return filtered("select called_at, account_id, client_id, server, tool, outcome, duration_ms from mcp_call",
				filter, " order by called_at desc, id limit :limit offset :offset")
			.param("limit", limit)
			.param("offset", offset)
			.query((row, number) -> new LoggedCall(row.getObject("called_at", OffsetDateTime.class).toInstant(),
					row.getObject("account_id", UUID.class), row.getString("client_id"), row.getString("server"),
					row.getString("tool"), row.getString("outcome"), row.getInt("duration_ms")))
			.list();
	}

	/** How many calls the filter keeps. */
	public long count(Filter filter) {
		return filtered("select count(*) from mcp_call", filter, "").query(Long.class).single();
	}

	/** The apps that called since this instant, or ever when it is null. */
	public List<String> clientsSince(@Nullable Instant from) {
		return filtered("select distinct client_id from mcp_call", new Filter(from, null, null, null, null), "")
			.query(String.class)
			.list();
	}

	private JdbcClient.StatementSpec filtered(String select, Filter filter, String tail) {
		List<String> where = new ArrayList<>();
		if (filter.from() != null) {
			where.add("called_at >= :from");
		}
		if (filter.clientId() != null) {
			where.add("client_id = :client");
		}
		if (filter.tool() != null) {
			where.add("tool = :tool");
		}
		if (filter.outcome() != null) {
			where.add("outcome = :outcome");
		}
		if (filter.accountIds() != null) {
			where.add(filter.accountIds().isEmpty() ? "false" : "account_id in (:accounts)");
		}
		JdbcClient.StatementSpec spec = jdbc
			.sql(select + (where.isEmpty() ? "" : " where " + String.join(" and ", where)) + tail);
		if (filter.from() != null) {
			spec = spec.param("from", OffsetDateTime.ofInstant(filter.from(), ZoneOffset.UTC));
		}
		if (filter.clientId() != null) {
			spec = spec.param("client", filter.clientId());
		}
		if (filter.tool() != null) {
			spec = spec.param("tool", filter.tool());
		}
		if (filter.outcome() != null) {
			spec = spec.param("outcome", filter.outcome());
		}
		if (filter.accountIds() != null && !filter.accountIds().isEmpty()) {
			spec = spec.param("accounts", filter.accountIds());
		}
		return spec;
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

	/** A call as the log keeps it. */
	public record LoggedCall(Instant calledAt, UUID accountId, String clientId, String server, String tool,
			String outcome, int durationMs) {
	}

	/**
	 * Which calls to keep; a null member keeps any.
	 * @param accountIds the people whose calls to keep; empty keeps none
	 */
	public record Filter(@Nullable Instant from, @Nullable String clientId, @Nullable String tool,
			@Nullable String outcome, @Nullable Collection<UUID> accountIds) {
	}

}
