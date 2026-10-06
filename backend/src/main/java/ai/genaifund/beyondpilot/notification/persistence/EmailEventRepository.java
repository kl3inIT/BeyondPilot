package ai.genaifund.beyondpilot.notification.persistence;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** What providers report about sent messages, and the message status those reports move forward. */
@Repository
public class EmailEventRepository {

	/** The message a report is about. */
	public record Reported(UUID id, String recipient, String status) {

		@Override
		public String toString() {
			return "Reported[id=" + id + ", status=" + status + "]";
		}

	}

	private final JdbcClient jdbc;

	EmailEventRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** The message a provider names by its own identifier. */
	public Optional<Reported> message(String provider, String providerMessageId) {
		return jdbc.sql("""
				select id, recipient, status from email_message
				where provider = :provider and provider_message_id = :providerMessageId
				""")
			.param("provider", provider)
			.param("providerMessageId", providerMessageId)
			.query((row, index) -> new Reported(row.getObject("id", UUID.class), row.getString("recipient"),
					row.getString("status")))
			.optional();
	}

	/**
	 * Records a report unless the same one was recorded before; whether it was recorded now.
	 * @param sourceId the provider's identifier of the report; null when it gives none
	 */
	public boolean record(UUID messageId, String type, Instant occurredAt, @Nullable String detail,
			@Nullable String sourceId) {
		return jdbc.sql("""
				insert into email_event (id, message_id, type, occurred_at, detail, source_id)
				values (:id, :messageId, :type, :occurredAt, :detail, :sourceId)
				on conflict (source_id) do nothing
				""")
			.param("id", UUID.randomUUID())
			.param("messageId", messageId)
			.param("type", type)
			.param("occurredAt", Timestamp.from(occurredAt))
			.param("detail", detail, Types.VARCHAR)
			.param("sourceId", sourceId, Types.VARCHAR)
			.update() == 1;
	}

	/**
	 * Moves a message's status forward: a report never takes it back. Delivered follows sent; a bounce or a complaint
	 * follows sent or delivered.
	 */
	public void advance(UUID messageId, String status) {
		jdbc.sql("""
				update email_message set status = :status, updated_at = now()
				where id = :id
				  and ((:status = 'delivered' and status = 'sent')
				       or (:status in ('bounced', 'complained') and status in ('sent', 'delivered')))
				""")
			.param("id", messageId)
			.param("status", status)
			.update();
	}

	/** When the newest report arrived, to show that reports reach BeyondPilot at all. */
	public Optional<Instant> latest() {
		return jdbc.sql("select max(occurred_at) from email_event").query(Timestamp.class).optional().map(Timestamp::toInstant);
	}

}
