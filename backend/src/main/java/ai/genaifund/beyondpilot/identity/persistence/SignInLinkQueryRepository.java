package ai.genaifund.beyondpilot.identity.persistence;

import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads the table that Spring Security's one-time-token service writes. */
@Repository
public class SignInLinkQueryRepository {

	private final JdbcClient jdbc;

	SignInLinkQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** How many links sent to this address still work at the given moment. */
	public int countUnexpired(String email, Instant at) {
		return jdbc.sql("select count(*) from one_time_tokens where lower(username) = lower(?) and expires_at > ?")
			.params(email, Timestamp.from(at))
			.query(Integer.class)
			.single();
	}
}
