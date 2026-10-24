package ai.genaifund.beyondpilot.usecase.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The roles members hold in single use cases, beyond what every member of the organization may do. */
@Repository
public class UseCaseAccessRepository {

	private final JdbcClient jdbc;

	UseCaseAccessRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One person's role in a use case, when they were given one. */
	public Optional<AccessRole> roleOf(UUID useCaseId, UUID accountId) {
		return jdbc.sql("select role from use_case_access where use_case_id = ? and account_id = ?")
			.params(useCaseId, accountId)
			.query(String.class)
			.optional()
			.flatMap(AccessRole::of);
	}

	/** The roles one person was given, by use case. A person is given few. */
	public Map<UUID, AccessRole> rolesOf(UUID accountId) {
		Map<UUID, AccessRole> roles = new LinkedHashMap<>();
		jdbc.sql("select use_case_id, role from use_case_access where account_id = ?")
			.param(accountId)
			.query((row, number) -> {
				UUID useCaseId = row.getObject("use_case_id", UUID.class);
				AccessRole.of(row.getString("role")).ifPresent(role -> roles.put(useCaseId, role));
				return 0;
			})
			.list();
		return roles;
	}

	/** One person given a role in a use case, with who gave it and when. */
	public record Grant(UUID accountId, AccessRole role, UUID addedByAccountId, Instant createdAt) {
	}

	/** Everyone given a role in a use case, the earliest first. */
	public List<Grant> grants(UUID useCaseId) {
		return jdbc.sql("""
				select account_id, role, added_by_account_id, created_at from use_case_access
				where use_case_id = ? order by created_at, account_id
				""")
			.param(useCaseId)
			.query((row, number) -> new Grant(row.getObject("account_id", UUID.class),
					AccessRole.of(row.getString("role")).orElse(AccessRole.VIEWER),
					row.getObject("added_by_account_id", UUID.class), row.getTimestamp("created_at").toInstant()))
			.list();
	}

	/** Gives a person a role in a use case, or changes the one they have. */
	public void set(UUID useCaseId, UUID accountId, AccessRole role, UUID addedBy, Instant now) {
		jdbc.sql("""
				insert into use_case_access (use_case_id, account_id, role, added_by_account_id, created_at)
				values (?, ?, ?, ?, ?)
				on conflict (use_case_id, account_id) do update set role = excluded.role
				""")
			.params(useCaseId, accountId, role.code(), addedBy, Timestamp.from(now))
			.update();
	}

	/** Takes a person's role away; true when they had one. */
	public boolean remove(UUID useCaseId, UUID accountId) {
		return jdbc.sql("delete from use_case_access where use_case_id = ? and account_id = ?")
			.params(useCaseId, accountId)
			.update() > 0;
	}

}
