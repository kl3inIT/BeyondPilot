package ai.genaifund.beyondpilot.introduction.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The requests for an introduction. The rows change by single statements, so they are written here and not through
 * entities.
 */
@Repository
public class IntroductionRepository {

	public static final String PENDING = "pending";

	public static final String REPLIED = "replied";

	public static final String DECLINED = "declined";

	private static final String COLUMNS = """
			select id, solution_id, solution_name, provider_organization_id, sender_account_id, sender_organization_id,
			       message, status, created_at, answered_at
			from introduction_request
			""";

	private static final String ADMIN_FILTER = """
			where (cast(:pattern as text) is null or lower(solution_name) like :pattern escape '\\')
			  and (cast(:status as text) is null or status = :status)
			""";

	private final JdbcClient jdbc;

	IntroductionRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Gives the requests to and from a merged organization to the one kept. */
	public void moveToOrganization(UUID from, UUID into) {
		jdbc.sql("update introduction_request set provider_organization_id = ? where provider_organization_id = ?")
			.params(into, from)
			.update();
		jdbc.sql("update introduction_request set sender_organization_id = ? where sender_organization_id = ?")
			.params(into, from)
			.update();
	}

	/** One request for an introduction. */
	public record Request(UUID id, UUID solutionId, String solutionName, UUID providerOrganizationId,
			UUID senderAccountId, UUID senderOrganizationId, String message, String status, Instant createdAt,
			@Nullable Instant answeredAt) {
	}

	/** Whether this sender already has a request to this solution that waits for its answer. */
	public boolean pendingFrom(UUID senderAccountId, UUID solutionId) {
		return jdbc.sql("""
				select exists (select 1 from introduction_request
				               where sender_account_id = ? and solution_id = ? and status = 'pending')
				""").params(senderAccountId, solutionId).query(Boolean.class).single();
	}

	/**
	 * Records a request.
	 * @return false when the sender already has one waiting for this solution
	 */
	public boolean add(UUID solutionId, String solutionName, UUID providerOrganizationId, UUID senderAccountId,
			UUID senderOrganizationId, String message) {
		try {
			jdbc.sql("""
					insert into introduction_request (id, solution_id, solution_name, provider_organization_id,
					                                  sender_account_id, sender_organization_id, message)
					values (?, ?, ?, ?, ?, ?, ?)
					""")
				.params(UUID.randomUUID(), solutionId, solutionName, providerOrganizationId, senderAccountId,
						senderOrganizationId, message)
				.update();
			return true;
		}
		catch (DuplicateKeyException exception) {
			return false;
		}
	}

	/** The requests to an organization, the most recent first. */
	public List<Request> receivedBy(UUID providerOrganizationId, int limit) {
		return jdbc.sql(COLUMNS + "where provider_organization_id = ? order by created_at desc, id limit ?")
			.params(providerOrganizationId, limit)
			.query(IntroductionRepository::request)
			.list();
	}

	/** The request, locked until the transaction ends so that two answers cannot both win. */
	public Optional<Request> findForUpdate(UUID id) {
		return jdbc.sql(COLUMNS + "where id = ? for update").param(id).query(IntroductionRepository::request).optional();
	}

	/** Marks a waiting request as answered. */
	public void answer(UUID id, String status, UUID answeredBy) {
		jdbc.sql("update introduction_request set status = ?, answered_at = now(), answered_by_account_id = ? where id = ?")
			.params(status, answeredBy, id)
			.update();
	}

	/** One page for operators: those that wait first, the longest wait on top, then the answered, newest first. */
	public List<Request> adminPage(@Nullable String text, @Nullable String status, int limit, long offset) {
		return adminFiltered(COLUMNS + ADMIN_FILTER + """
				order by case status when 'pending' then 0 else 1 end,
				         case when status = 'pending' then created_at end asc,
				         created_at desc, id
				limit :limit offset :offset
				""", text, status).param("limit", limit).param("offset", offset).query(IntroductionRepository::request).list();
	}

	public long adminCount(@Nullable String text, @Nullable String status) {
		return adminFiltered("select count(*) from introduction_request\n" + ADMIN_FILTER, text, status)
			.query(Long.class)
			.single();
	}

	/** How many requests were sent before the moment given and still wait. */
	public long pendingBefore(Instant moment) {
		return jdbc.sql("select count(*) from introduction_request where status = 'pending' and created_at < ?")
			.param(Timestamp.from(moment))
			.query(Long.class)
			.single();
	}

	private JdbcClient.StatementSpec adminFiltered(String sql, @Nullable String text, @Nullable String status) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("status", status, Types.VARCHAR);
	}

	/** A pattern that matches the text anywhere, with the characters LIKE gives a meaning taken literally. */
	private static String containing(String text) {
		String literal = text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + literal + "%";
	}

	private static Request request(ResultSet row, int index) throws SQLException {
		Timestamp answered = row.getTimestamp("answered_at");
		return new Request(row.getObject("id", UUID.class), row.getObject("solution_id", UUID.class),
				row.getString("solution_name"), row.getObject("provider_organization_id", UUID.class),
				row.getObject("sender_account_id", UUID.class), row.getObject("sender_organization_id", UUID.class),
				row.getString("message"), row.getString("status"), row.getTimestamp("created_at").toInstant(),
				answered == null ? null : answered.toInstant());
	}
}
