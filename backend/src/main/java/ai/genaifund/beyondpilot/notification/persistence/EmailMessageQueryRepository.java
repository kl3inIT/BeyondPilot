package ai.genaifund.beyondpilot.notification.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.notification.dto.EmailMessageListResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageSummaryResponse;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The operators' reading of the email log: a filtered list read from one message towards the past or the present. */
@Repository
public class EmailMessageQueryRepository {

	/** One message with its content, before its events and suppression are joined in. */
	public record Content(UUID id, Instant createdAt, @Nullable Instant sentAt, String recipient, String kind,
			String subject, String html, String text, String status, int attempts, @Nullable String provider,
			@Nullable String providerMessageId, @Nullable String lastError) {
	}

	private static final String SELECT = """
			select id, created_at, recipient, kind, subject, status, attempts, last_error
			from email_message
			where (cast(:from as timestamptz) is null or created_at >= :from)
			  and (cast(:kind as text) is null or kind = :kind)
			  and (cast(:status as text) is null or status = :status)
			  and (cast(:pattern as text) is null
			       or lower(recipient) like :pattern escape '\\' or lower(subject) like :pattern escape '\\')
			""";

	private final JdbcClient jdbc;

	EmailMessageQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Up to {@code limit} messages older than the place given, or the newest ones without one; newest first. */
	public List<EmailMessageSummaryResponse> older(@Nullable Instant from, @Nullable String kind,
			@Nullable String status, @Nullable String text, @Nullable Instant at, @Nullable UUID id, int limit) {
		return filtered(SELECT + """
				  and (cast(:at as timestamptz) is null or (created_at, id) < (:at, cast(:id as uuid)))
				order by created_at desc, id desc
				limit :limit
				""", from, kind, status, text, at, id, limit);
	}

	/** Up to {@code limit} messages newer than the place given, nearest first. */
	public List<EmailMessageSummaryResponse> newer(@Nullable Instant from, @Nullable String kind,
			@Nullable String status, @Nullable String text, Instant at, UUID id, int limit) {
		return filtered(SELECT + """
				  and (created_at, id) > (:at, cast(:id as uuid))
				order by created_at, id
				limit :limit
				""", from, kind, status, text, at, id, limit);
	}

	/** What became of the messages of the period, of one kind or all. */
	public EmailMessageListResponse.Counts counts(@Nullable Instant from, @Nullable String kind) {
		return jdbc.sql("""
				select count(*) as total,
				       count(*) filter (where status in ('sent', 'delivered', 'bounced', 'complained')) as sent,
				       count(*) filter (where status = 'delivered') as delivered,
				       count(*) filter (where status = 'bounced') as bounced,
				       count(*) filter (where status = 'complained') as complained,
				       count(*) filter (where status in ('failed', 'skipped')) as not_sent
				from email_message
				where (cast(:from as timestamptz) is null or created_at >= :from)
				  and (cast(:kind as text) is null or kind = :kind)
				""")
			.param("from", time(from), Types.TIMESTAMP_WITH_TIMEZONE)
			.param("kind", kind, Types.VARCHAR)
			.query((row, index) -> new EmailMessageListResponse.Counts(row.getLong("total"), row.getLong("sent"),
					row.getLong("delivered"), row.getLong("bounced"), row.getLong("complained"),
					row.getLong("not_sent")))
			.single();
	}

	public Optional<Content> content(UUID id) {
		return jdbc.sql("""
				select id, created_at, sent_at, recipient, kind, subject, html, text, status, attempts, provider,
				       provider_message_id, last_error
				from email_message where id = :id
				""")
			.param("id", id)
			.query((row, index) -> new Content(row.getObject("id", UUID.class), instant(row, "created_at"),
					row.getObject("sent_at") == null ? null : instant(row, "sent_at"), row.getString("recipient"),
					row.getString("kind"), row.getString("subject"), row.getString("html"), row.getString("text"),
					row.getString("status"), row.getInt("attempts"), row.getString("provider"),
					row.getString("provider_message_id"), row.getString("last_error")))
			.optional();
	}

	public List<EmailMessageResponse.Event> events(UUID messageId) {
		return jdbc.sql("select type, occurred_at, detail from email_event where message_id = :id order by occurred_at, id")
			.param("id", messageId)
			.query((row, index) -> new EmailMessageResponse.Event(row.getString("type"), instant(row, "occurred_at"),
					row.getString("detail")))
			.list();
	}

	private List<EmailMessageSummaryResponse> filtered(String sql, @Nullable Instant from, @Nullable String kind,
			@Nullable String status, @Nullable String text, @Nullable Instant at, @Nullable UUID id, int limit) {
		return jdbc.sql(sql)
			.param("from", time(from), Types.TIMESTAMP_WITH_TIMEZONE)
			.param("kind", kind, Types.VARCHAR)
			.param("status", status, Types.VARCHAR)
			.param("pattern", containing(text), Types.VARCHAR)
			.param("at", time(at), Types.TIMESTAMP_WITH_TIMEZONE)
			.param("id", id == null ? null : id.toString(), Types.VARCHAR)
			.param("limit", limit)
			.query((row, index) -> summary(row))
			.list();
	}

	private static EmailMessageSummaryResponse summary(ResultSet row) throws SQLException {
		return new EmailMessageSummaryResponse(row.getObject("id", UUID.class), instant(row, "created_at"),
				row.getString("recipient"), row.getString("kind"), row.getString("subject"), row.getString("status"),
				row.getInt("attempts"), row.getString("last_error"));
	}

	private static Instant instant(ResultSet row, String column) throws SQLException {
		return row.getObject(column, OffsetDateTime.class).toInstant();
	}

	private static @Nullable OffsetDateTime time(@Nullable Instant instant) {
		return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
	}

	private static @Nullable String containing(@Nullable String text) {
		if (text == null || text.isBlank()) {
			return null;
		}
		return "%" + text.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
				+ "%";
	}

}
