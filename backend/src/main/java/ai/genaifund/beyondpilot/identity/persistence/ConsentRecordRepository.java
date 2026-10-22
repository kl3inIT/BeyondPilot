package ai.genaifund.beyondpilot.identity.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The append-only record of what each person agreed to about their personal data. */
@Repository
public class ConsentRecordRepository {

	private final JdbcClient jdbc;

	ConsentRecordRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One choice, as a new row. */
	public void insert(UUID accountId, String purpose, boolean granted, int version, String locale, String source,
			@Nullable String requestId) {
		jdbc.sql("""
				insert into identity_consent_record (id, account_id, purpose, granted, version, locale, source, request_id)
				values (:id, :account, :purpose, :granted, :version, :locale, :source, cast(:request as uuid))
				""")
			.param("id", UUID.randomUUID())
			.param("account", accountId)
			.param("purpose", purpose)
			.param("granted", granted)
			.param("version", version)
			.param("locale", locale)
			.param("source", source)
			.param("request", requestId)
			.update();
	}

	/** The latest choice for each purpose the account has answered. */
	public List<Choice> latest(UUID accountId) {
		return jdbc.sql("""
				select distinct on (purpose) purpose, granted, version, recorded_at
				from identity_consent_record
				where account_id = :account
				order by purpose, recorded_at desc, id
				""")
			.param("account", accountId)
			.query((row, index) -> new Choice(row.getString("purpose"), row.getBoolean("granted"), row.getInt("version"),
					row.getTimestamp("recorded_at").toInstant()))
			.list();
	}

	/** A purpose's latest answer: agreed or declined, under which version of the text, and when. */
	public record Choice(String purpose, boolean granted, int version, Instant recordedAt) {
	}
}
