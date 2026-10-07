package ai.genaifund.beyondpilot.identity.persistence;

import java.sql.Types;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.dto.AccountSummaryResponse;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The operators' list of accounts: a filtered, paged projection and its count. */
@Repository
public class AccountQueryRepository {

	private static final String FILTER = """
			where (cast(:pattern as text) is null
			       or lower(email) like :pattern escape '\\' or lower(display_name) like :pattern escape '\\')
			  and (cast(:status as text) is null or status = :status)
			  and (cast(:role as text) is null or platform_role = :role)
			""";

	private final JdbcClient jdbc;

	AccountQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * One page, latest sign-in first; accounts that never completed one come last, newest first.
	 * @param configuredOperators the lowercase addresses the server configuration names as operators
	 */
	public List<AccountSummaryResponse> page(@Nullable String text, @Nullable String status, @Nullable String role,
			Set<String> configuredOperators, int limit, long offset) {
		return filtered("""
				select id, email, display_name, platform_role, status, last_login_at, created_at
				from identity_account
				""" + FILTER + """
				order by last_login_at desc nulls last, created_at desc, id
				limit :limit offset :offset
				""", text, status, role).param("limit", limit)
			.param("offset", offset)
			.query((row, index) -> new AccountSummaryResponse(row.getObject("id", UUID.class), row.getString("email"),
					row.getString("display_name"), row.getString("platform_role"), row.getString("status"),
					row.getTimestamp("last_login_at") == null ? null : row.getTimestamp("last_login_at").toInstant(),
					row.getTimestamp("created_at").toInstant(),
					configuredOperators.contains(row.getString("email").toLowerCase(Locale.ROOT))))
			.list();
	}

	public long count(@Nullable String text, @Nullable String status, @Nullable String role) {
		return filtered("select count(*) from identity_account\n" + FILTER, text, status, role).query(Long.class)
			.single();
	}

	/** The accounts whose name or address contains the text, ignoring case, at most this many. */
	public List<UUID> idsMatching(String text, int limit) {
		return filtered("select id from identity_account " + FILTER + " order by id limit :limit", text, null, null)
			.param("limit", limit)
			.query(UUID.class)
			.list();
	}

	private JdbcClient.StatementSpec filtered(String sql, @Nullable String text, @Nullable String status,
			@Nullable String role) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("status", status, Types.VARCHAR)
			.param("role", role, Types.VARCHAR);
	}

	/** A pattern that matches the text anywhere, with the characters LIKE gives a meaning taken literally. */
	private static String containing(String text) {
		String literal = text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + literal + "%";
	}

}
