package ai.genaifund.beyondpilot.identity.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * What identity does to the authorization server's tables beyond Spring's own repositories: whether a connection still
 * stands, a person's connected apps, revoking one, and deleting connections that can no longer be used. A connection
 * is an authorization the person consented to whose refresh token still works.
 */
@Repository
public class OAuthTableRepository {

	private final JdbcClient jdbc;

	OAuthTableRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Whether this person's connection still stands: not revoked, not expired. */
	public boolean isStanding(String connectionId, String principal) {
		return jdbc.sql("""
				select exists (select 1 from oauth2_authorization a
				               where a.id = :id and a.principal_name = :principal
				                 and a.access_token_value is not null and a.refresh_token_expires_at > now())
				""")
			.param("id", connectionId)
			.param("principal", principal)
			.query(Boolean.class)
			.single();
	}

	/** The person's standing connections, one per app, the latest use first. */
	public List<Connection> connectionsOf(String principal) {
		return jdbc.sql("""
				select c.id as app_id, c.client_id, c.client_name,
				       string_agg(distinct a.authorized_scopes, ',') as scopes,
				       min(a.authorization_code_issued_at) as allowed_at,
				       max(a.access_token_issued_at) as used_at
				from oauth2_authorization a
				join oauth2_registered_client c on c.id = a.registered_client_id
				where a.principal_name = :principal
				  and a.access_token_value is not null and a.refresh_token_expires_at > now()
				group by c.id, c.client_id, c.client_name
				order by used_at desc
				""")
			.param("principal", principal)
			.query((row, number) -> new Connection(row.getString("app_id"), row.getString("client_id"),
					row.getString("client_name"), row.getString("scopes"), instant(row.getObject("allowed_at", OffsetDateTime.class)),
					instant(row.getObject("used_at", OffsetDateTime.class))))
			.list();
	}

	/**
	 * Ends every connection of this person with this app.
	 * @return how many authorizations were deleted
	 */
	public int revoke(String principal, String appId) {
		return jdbc.sql("delete from oauth2_authorization where principal_name = :principal and registered_client_id = :app")
			.param("principal", principal)
			.param("app", appId)
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

	private static @Nullable Instant instant(@Nullable OffsetDateTime at) {
		return at == null ? null : at.toInstant();
	}

	/**
	 * A person's connection with one app.
	 * @param appId the app's row, the identifier a revoke names
	 * @param scopes the scopes granted across the person's connections with the app, comma-separated
	 * @param allowedAt when the person first consented
	 * @param usedAt when the app last got a token, which it does only while in use
	 */
	public record Connection(String appId, String clientId, String clientName, @Nullable String scopes,
			@Nullable Instant allowedAt, @Nullable Instant usedAt) {
	}

}
