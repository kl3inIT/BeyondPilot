package ai.genaifund.beyondpilot.notification.persistence;

import java.util.Locale;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The addresses BeyondPilot no longer sends to, kept lowercased. */
@Repository
public class EmailSuppressionRepository {

	private final JdbcClient jdbc;

	EmailSuppressionRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public boolean isSuppressed(String address) {
		return jdbc.sql("select exists (select 1 from email_suppression where address = :address)")
			.param("address", address.toLowerCase(Locale.ROOT))
			.query(Boolean.class)
			.single();
	}

}
