package ai.genaifund.beyondpilot.audit.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.dto.AuditEventResponse;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** The operators' reading of the audit log: a filtered projection, read from one event towards the past or the present. */
@Repository
public class AuditEventQueryRepository {

	private static final TypeReference<Map<String, String>> DETAILS = new TypeReference<>() {
	};

	private static final String SELECT = """
			select id, occurred_at, action, actor_id, actor_label, actor_email, resource_type, resource_id,
			       resource_label, details::text as details, request_id
			from audit_event
			where (cast(:from as timestamptz) is null or occurred_at >= :from)
			  and (cast(:action as text) is null or action = :action)
			  and (cast(:pattern as text) is null
			       or lower(actor_label) like :pattern escape '\\' or lower(actor_email) like :pattern escape '\\'
			       or lower(resource_label) like :pattern escape '\\')
			""";

	private final JdbcClient jdbc;

	private final JsonMapper json;

	AuditEventQueryRepository(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	/** Up to {@code limit} events older than the place given, or the newest ones without a place; newest first. */
	public List<AuditEventResponse> older(@Nullable Instant from, @Nullable AuditAction action, @Nullable String text,
			@Nullable Instant at, @Nullable UUID id, int limit) {
		return filtered(SELECT + """
				  and (cast(:at as timestamptz) is null or (occurred_at, id) < (:at, cast(:id as uuid)))
				order by occurred_at desc, id desc
				limit :limit
				""", from, action, text, at, id, limit);
	}

	/** Up to {@code limit} events newer than the place given, nearest first: the reverse of the order they are shown in. */
	public List<AuditEventResponse> newer(@Nullable Instant from, @Nullable AuditAction action, @Nullable String text,
			Instant at, UUID id, int limit) {
		return filtered(SELECT + """
				  and (occurred_at, id) > (:at, cast(:id as uuid))
				order by occurred_at, id
				limit :limit
				""", from, action, text, at, id, limit);
	}

	private List<AuditEventResponse> filtered(String sql, @Nullable Instant from, @Nullable AuditAction action,
			@Nullable String text, @Nullable Instant at, @Nullable UUID id, int limit) {
		return jdbc.sql(sql)
			.param("from", time(from), Types.TIMESTAMP_WITH_TIMEZONE)
			.param("action", action == null ? null : action.value(), Types.VARCHAR)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("at", time(at), Types.TIMESTAMP_WITH_TIMEZONE)
			.param("id", id == null ? null : id.toString(), Types.VARCHAR)
			.param("limit", limit)
			.query((row, index) -> event(row))
			.list();
	}

	private AuditEventResponse event(ResultSet row) throws SQLException {
		UUID actor = row.getObject("actor_id", UUID.class);
		return new AuditEventResponse(row.getObject("id", UUID.class),
				row.getObject("occurred_at", OffsetDateTime.class).toInstant(), AuditAction.of(row.getString("action")),
				actor == null ? null
						: new AuditEventResponse.Actor(actor, row.getString("actor_label"), row.getString("actor_email")),
				new AuditEventResponse.Resource(row.getString("resource_type"), row.getString("resource_id"),
						row.getString("resource_label")),
				json.readValue(row.getString("details"), DETAILS), row.getObject("request_id", UUID.class));
	}

	private static @Nullable OffsetDateTime time(@Nullable Instant instant) {
		return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
	}

	/** A pattern that matches the text anywhere, with the characters LIKE gives a meaning taken literally. */
	private static String containing(String text) {
		String literal = text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + literal + "%";
	}

}
