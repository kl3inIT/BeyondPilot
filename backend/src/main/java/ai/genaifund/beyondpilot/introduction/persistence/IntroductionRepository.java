package ai.genaifund.beyondpilot.introduction.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
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

	private final JdbcClient jdbc;

	IntroductionRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
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

	private static Request request(ResultSet row, int index) throws SQLException {
		java.sql.Timestamp answered = row.getTimestamp("answered_at");
		return new Request(row.getObject("id", UUID.class), row.getObject("solution_id", UUID.class),
				row.getString("solution_name"), row.getObject("provider_organization_id", UUID.class),
				row.getObject("sender_account_id", UUID.class), row.getObject("sender_organization_id", UUID.class),
				row.getString("message"), row.getString("status"), row.getTimestamp("created_at").toInstant(),
				answered == null ? null : answered.toInstant());
	}
}
