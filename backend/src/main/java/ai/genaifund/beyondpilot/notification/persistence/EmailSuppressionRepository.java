package ai.genaifund.beyondpilot.notification.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionResponse;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The addresses BeyondPilot no longer sends to, kept lowercased. */
@Repository
public class EmailSuppressionRepository {

	private static final String SELECT = """
			select s.address, s.reason, s.created_at, s.created_by_label, s.message_id, m.kind as message_kind
			from email_suppression s left join email_message m on m.id = s.message_id
			""";

	private static final String FILTER = """
			where (cast(:reason as text) is null or s.reason = :reason)
			  and (cast(:pattern as text) is null or s.address like :pattern escape '\\')
			""";

	private final JdbcClient jdbc;

	EmailSuppressionRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public boolean isSuppressed(String address) {
		return jdbc.sql("select exists (select 1 from email_suppression where address = :address)")
			.param("address", lower(address))
			.query(Boolean.class)
			.single();
	}

	public Optional<EmailSuppressionResponse> find(String address) {
		return jdbc.sql(SELECT + " where s.address = :address")
			.param("address", lower(address))
			.query(this::suppression)
			.optional();
	}

	/** One page, newest first. */
	public List<EmailSuppressionResponse> page(@Nullable String reason, @Nullable String text, int offset, int limit) {
		return jdbc.sql(SELECT + FILTER + " order by s.created_at desc, s.address limit :limit offset :offset")
			.param("reason", reason, Types.VARCHAR)
			.param("pattern", containing(text), Types.VARCHAR)
			.param("limit", limit)
			.param("offset", offset)
			.query(this::suppression)
			.list();
	}

	public long count(@Nullable String reason, @Nullable String text) {
		return jdbc.sql("select count(*) from email_suppression s " + FILTER)
			.param("reason", reason, Types.VARCHAR)
			.param("pattern", containing(text), Types.VARCHAR)
			.query(Long.class)
			.single();
	}

	/**
	 * Suppresses an address unless it already is; whether it was added.
	 * @param messageId the email that caused it; null when an operator added it
	 * @param createdBy the operator who added it; null when a provider's report did
	 */
	public boolean add(String address, String reason, @Nullable UUID messageId, @Nullable UUID createdBy,
			@Nullable String createdByLabel) {
		return jdbc.sql("""
				insert into email_suppression (address, reason, message_id, created_by, created_by_label)
				values (:address, :reason, :messageId, :createdBy, :createdByLabel)
				on conflict (address) do nothing
				""")
			.param("address", lower(address))
			.param("reason", reason)
			.param("messageId", messageId, Types.OTHER)
			.param("createdBy", createdBy, Types.OTHER)
			.param("createdByLabel", createdByLabel, Types.VARCHAR)
			.update() == 1;
	}

	/** Lets email reach the address again; whether it was suppressed. */
	public boolean remove(String address) {
		return jdbc.sql("delete from email_suppression where address = :address")
			.param("address", lower(address))
			.update() == 1;
	}

	private EmailSuppressionResponse suppression(ResultSet row, int index) throws SQLException {
		return new EmailSuppressionResponse(row.getString("address"), row.getString("reason"),
				row.getObject("created_at", OffsetDateTime.class).toInstant(), row.getString("created_by_label"),
				row.getObject("message_id", UUID.class), row.getString("message_kind"));
	}

	private static String lower(String address) {
		return address.strip().toLowerCase(Locale.ROOT);
	}

	private static @Nullable String containing(@Nullable String text) {
		if (text == null || text.isBlank()) {
			return null;
		}
		return "%" + text.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
				+ "%";
	}

}
