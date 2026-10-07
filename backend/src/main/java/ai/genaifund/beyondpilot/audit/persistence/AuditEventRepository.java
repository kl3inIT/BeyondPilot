package ai.genaifund.beyondpilot.audit.persistence;

import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditRecord;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/** Inserts into and counts the append-only {@code audit_event} table; nothing here updates or deletes. */
@Repository
public class AuditEventRepository {

	private final JdbcClient jdbc;

	private final JsonMapper json;

	AuditEventRepository(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	public void insert(UUID id, AuditRecord record, @Nullable String requestId) {
		AuditRecord.Actor actor = record.actor();
		jdbc.sql("""
				insert into audit_event (id, action, actor_id, actor_label, actor_email, resource_type, resource_id,
				    resource_label, details, request_id)
				values (:id, :action, :actorId, :actorLabel, :actorEmail, :resourceType, :resourceId, :resourceLabel,
				    cast(:details as jsonb), cast(:requestId as uuid))
				""")
			.param("id", id)
			.param("action", record.action().value())
			.param("actorId", actor == null ? null : actor.id(), Types.OTHER)
			.param("actorLabel", actor == null ? null : actor.label(), Types.VARCHAR)
			.param("actorEmail", actor == null ? null : actor.email(), Types.VARCHAR)
			.param("resourceType", record.resource().type())
			.param("resourceId", record.resource().id())
			.param("resourceLabel", record.resource().label())
			.param("details", json.writeValueAsString(record.details()))
			.param("requestId", requestId, Types.VARCHAR)
			.update();
	}

	public long count(String action, UUID actorId, Instant since) {
		return jdbc.sql("""
				select count(*) from audit_event
				where actor_id = :actorId and action = :action and occurred_at >= :since
				""")
			.param("actorId", actorId)
			.param("action", action)
			.param("since", OffsetDateTime.ofInstant(since, ZoneOffset.UTC))
			.query(Long.class)
			.single();
	}

}
