package ai.genaifund.beyondpilot.identity.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * What identity does to the authorization server's tables beyond Spring's own repositories: marking when a client's
 * metadata document was read, and deleting connections that can no longer be used.
 */
@Repository
public class OAuthTableRepository {

	private final JdbcClient jdbc;

	OAuthTableRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Records when the client's metadata document was read; Spring's update leaves that column alone. */
	public void markRead(String registeredClientId, Instant at) {
		jdbc.sql("update oauth2_registered_client set client_id_issued_at = :at where id = :id")
			.param("at", OffsetDateTime.ofInstant(at, ZoneOffset.UTC))
			.param("id", registeredClientId)
			.update();
	}

	/**
	 * Deletes the authorizations no token of which works any more: the refresh token expired, or, without one, the
	 * access token or the code did.
	 * @return how many were deleted
	 */
	public int deleteExpired(Instant before) {
		return jdbc.sql("""
				delete from oauth2_authorization
				where coalesce(refresh_token_expires_at, access_token_expires_at, authorization_code_expires_at) < :before
				""").param("before", OffsetDateTime.ofInstant(before, ZoneOffset.UTC)).update();
	}

}
