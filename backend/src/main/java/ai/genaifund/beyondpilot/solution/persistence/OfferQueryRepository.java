package ai.genaifund.beyondpilot.solution.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The offers read as projections: every offer for the operators, those a solution of an organization may choose,
 * and those the solutions of a page come with.
 */
@Repository
public class OfferQueryRepository {

	private static final String ROW = """
			select id, organization_id, title, url, from_genai_fund, version, updated_at, closed_at,
			       (select count(*) from solution_offer so where so.offer_id = offer.id) as solutions
			from offer
			""";

	private final JdbcClient jdbc;

	OfferQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * One offer, with how many solutions come with it.
	 * @param organizationId the organization that gives it
	 * @param fromGenAiFund whether GenAI Fund arranged it
	 */
	public record Row(UUID id, UUID organizationId, String title, String url, boolean fromGenAiFund, int solutions,
			long version, Instant updatedAt, boolean closed) {
	}

	/** A solution that comes with an offer, as the operators' record of the offer lists it. */
	public record Coming(UUID id, UUID organizationId, String slug, String name, String status,
			@Nullable Instant suspendedAt) {
	}

	/** An offer as one solution comes with it. */
	public record Attached(UUID solutionId, UUID id, String title, String url, boolean fromGenAiFund, boolean closed) {
	}

	/** Every offer, each organization's together, by title. */
	public List<Row> all() {
		return jdbc.sql(ROW + "order by organization_id, lower(title), id")
			.query(OfferQueryRepository::row)
			.list();
	}

	/**
	 * The offers the solution may come with, by title: the open ones of its organization, and a closed one the solution
	 * already comes with, which it keeps.
	 */
	public List<Row> availableTo(UUID organizationId, UUID solutionId) {
		return jdbc.sql(ROW + """
				where organization_id = :organizationId
				  and (closed_at is null or exists (
				         select 1 from solution_offer so where so.offer_id = offer.id and so.solution_id = :solutionId))
				order by lower(title), id
				""")
			.param("organizationId", organizationId)
			.param("solutionId", solutionId)
			.query(OfferQueryRepository::row)
			.list();
	}

	/** The offers an organization gives, by title. */
	public List<Row> writtenBy(UUID organizationId) {
		return jdbc.sql(ROW + "where organization_id = :organizationId order by lower(title), id")
			.param("organizationId", organizationId)
			.query(OfferQueryRepository::row)
			.list();
	}

	/** The solutions that come with the offer, by name. */
	public List<Coming> solutionsWith(UUID offerId) {
		return jdbc.sql("""
				select s.id, s.organization_id, s.slug, s.name, s.status, s.suspended_at
				from solution_offer so
				join solution s on s.id = so.solution_id
				where so.offer_id = :offerId
				order by lower(s.name), s.id
				""")
			.param("offerId", offerId)
			.query((row, index) -> new Coming(row.getObject("id", UUID.class),
					row.getObject("organization_id", UUID.class), row.getString("slug"), row.getString("name"),
					row.getString("status"),
					row.getTimestamp("suspended_at") == null ? null : row.getTimestamp("suspended_at").toInstant()))
			.list();
	}

	/** The offers of these solutions in one read, each solution's by title. */
	public List<Attached> attachedTo(Collection<UUID> solutionIds) {
		if (solutionIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("""
				select so.solution_id, o.id, o.title, o.url, o.from_genai_fund, o.closed_at
				from solution_offer so
				join offer o on o.id = so.offer_id
				where so.solution_id = any(cast(:solutionIds as uuid[]))
				order by so.solution_id, lower(o.title), o.id
				""")
			// A PostgreSQL array literal: an identifier holds no character that needs quoting.
			.param("solutionIds", solutionIds.stream().map(UUID::toString).collect(Collectors.joining(",", "{", "}")),
					Types.VARCHAR)
			.query((row, index) -> new Attached(row.getObject("solution_id", UUID.class),
					row.getObject("id", UUID.class), row.getString("title"), row.getString("url"),
					row.getBoolean("from_genai_fund"), row.getTimestamp("closed_at") != null))
			.list();
	}

	/**
	 * Gives the offers of a merged organization to the one kept, with its solutions. Each version moves on, so a save
	 * read before the merge is refused.
	 */
	public void moveToOrganization(UUID from, UUID into) {
		jdbc.sql("update offer set organization_id = ?, version = version + 1 where organization_id = ?")
			.params(into, from)
			.update();
	}

	private static Row row(ResultSet row, int index) throws SQLException {
		return new Row(row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
				row.getString("title"), row.getString("url"), row.getBoolean("from_genai_fund"), row.getInt("solutions"),
				row.getLong("version"),
				row.getTimestamp("updated_at").toInstant(), row.getTimestamp("closed_at") != null);
	}
}
