package ai.genaifund.beyondpilot.notification.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The queue and log of email: rendered messages, claimed by a sender with a lease so that no two senders take the same
 * message, and marked with how their delivery went.
 */
@Repository
public class EmailMessageRepository {

	/** A message a sender has claimed: what it hands to the provider. */
	public record Claimed(UUID id, String kind, String recipient, String subject, String html, String text,
			int attempts) {

		@Override
		public String toString() {
			return "Claimed[id=" + id + ", kind=" + kind + ", attempts=" + attempts + "]";
		}

	}

	private static final String RETURNING = " returning id, kind, recipient, subject, html, text, attempts";

	private final JdbcClient jdbc;

	EmailMessageRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Records a rendered message to send now: queued and due. */
	public void insertQueued(UUID id, String kind, String recipient, String subject, String html, String text) {
		insert(id, kind, recipient, subject, html, text, "queued", null);
	}

	/** Records a message that is not sent, with the reason. */
	public void insertSkipped(UUID id, String kind, String recipient, String subject, String html, String text,
			String reason) {
		insert(id, kind, recipient, subject, html, text, "skipped", reason);
	}

	private void insert(UUID id, String kind, String recipient, String subject, String html, String text,
			String status, @Nullable String reason) {
		jdbc.sql("""
				insert into email_message (id, kind, recipient, subject, html, text, status, last_error)
				values (:id, :kind, :recipient, :subject, :html, :text, :status, :reason)
				""")
			.param("id", id)
			.param("kind", kind)
			.param("recipient", recipient)
			.param("subject", subject)
			.param("html", html)
			.param("text", text)
			.param("status", status)
			.param("reason", reason, Types.VARCHAR)
			.update();
	}

	/**
	 * Takes one queued message that is due, moving its next attempt past the lease so that nothing else takes it
	 * meanwhile, and counts the attempt. Empty when it is not queued, not due, or already taken.
	 */
	public Optional<Claimed> claim(UUID id, Duration lease) {
		return jdbc.sql("""
				update email_message
				set next_attempt_at = now() + cast(:lease as interval), attempts = attempts + 1, updated_at = now()
				where id = :id and status = 'queued' and next_attempt_at <= now()
				""" + RETURNING)
			.param("id", id)
			.param("lease", interval(lease))
			.query(this::claimed)
			.optional();
	}

	/** Takes up to {@code limit} queued messages that are due, oldest first, skipping those another sender holds. */
	public List<Claimed> claimDue(int limit, Duration lease) {
		return jdbc.sql("""
				update email_message
				set next_attempt_at = now() + cast(:lease as interval), attempts = attempts + 1, updated_at = now()
				where id in (select id from email_message
				             where status = 'queued' and next_attempt_at <= now()
				             order by next_attempt_at
				             limit :limit
				             for update skip locked)
				""" + RETURNING)
			.param("lease", interval(lease))
			.param("limit", limit)
			.query(this::claimed)
			.list();
	}

	public void markSent(UUID id, String provider, String providerMessageId) {
		jdbc.sql("""
				update email_message
				set status = 'sent', provider = :provider, provider_message_id = :providerMessageId, last_error = null,
				    sent_at = now(), updated_at = now()
				where id = :id
				""")
			.param("id", id)
			.param("provider", provider)
			.param("providerMessageId", providerMessageId)
			.update();
	}

	/** Leaves the message queued for another attempt at the time given. */
	public void markRetry(UUID id, Instant nextAttemptAt, String reason) {
		jdbc.sql("""
				update email_message set next_attempt_at = :next, last_error = :reason, updated_at = now()
				where id = :id and status = 'queued'
				""")
			.param("id", id)
			.param("next", Timestamp.from(nextAttemptAt))
			.param("reason", reason)
			.update();
	}

	public void markFailed(UUID id, String reason) {
		jdbc.sql("update email_message set status = 'failed', last_error = :reason, updated_at = now() where id = :id")
			.param("id", id)
			.param("reason", reason)
			.update();
	}

	/** Fails every message still queued that was created before the time given; how many. */
	public int expire(Instant createdBefore, String reason) {
		return jdbc.sql("""
				update email_message set status = 'failed', last_error = :reason, updated_at = now()
				where status = 'queued' and created_at < :before
				""")
			.param("before", Timestamp.from(createdBefore))
			.param("reason", reason)
			.update();
	}

	/** Deletes messages, and their events, created before the time given; how many. */
	public int purge(Instant createdBefore) {
		return jdbc.sql("delete from email_message where created_at < :before")
			.param("before", Timestamp.from(createdBefore))
			.update();
	}

	private Claimed claimed(ResultSet row, int index) throws SQLException {
		return new Claimed(row.getObject("id", UUID.class), row.getString("kind"), row.getString("recipient"),
				row.getString("subject"), row.getString("html"), row.getString("text"), row.getInt("attempts"));
	}

	private static String interval(Duration duration) {
		return String.format(Locale.ROOT, "%d seconds", duration.toSeconds());
	}

}
