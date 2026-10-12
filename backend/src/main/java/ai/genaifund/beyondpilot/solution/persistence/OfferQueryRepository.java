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
			select id, organization_id, title, url, version, updated_at,
			       (select count(*) from solution_offer so where so.offer_id = offer.id) as solutions
			from offer
			""";

	private final JdbcClient jdbc;

	OfferQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * One offer, with how many solutions come with it.
	 * @param organizationId the organization that wrote it; null for an offer of GenAI Fund's list
	 */
	public record Row(UUID id, @Nullable UUID organizationId, String title, String url, int solutions, long version,
			Instant updatedAt) {
	}

	/** An offer as one solution comes with it. */
	public record Attached(UUID solutionId, UUID id, @Nullable UUID organizationId, String title, String url) {
	}

	/** Every offer: GenAI Fund's first, then each organization's, by title. */
	public List<Row> all() {
		return jdbc.sql(ROW + "order by organization_id nulls first, lower(title), id")
			.query(OfferQueryRepository::row)
			.list();
	}

	/** The offers a solution of the organization may come with: GenAI Fund's and the organization's own, by title. */
	public List<Row> availableTo(UUID organizationId) {
		return jdbc.sql(ROW + "where organization_id is null or organization_id = :organizationId\n"
				+ "order by lower(title), id")
			.param("organizationId", organizationId)
			.query(OfferQueryRepository::row)
			.list();
	}

	/** The offers an organization wrote, by title. */
	public List<Row> writtenBy(UUID organizationId) {
		return jdbc.sql(ROW + "where organization_id = :organizationId order by lower(title), id")
			.param("organizationId", organizationId)
			.query(OfferQueryRepository::row)
			.list();
	}

	/** The offers of these solutions in one read, each solution's by title. */
	public List<Attached> attachedTo(Collection<UUID> solutionIds) {
		if (solutionIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("""
				select so.solution_id, o.id, o.organization_id, o.title, o.url
				from solution_offer so
				join offer o on o.id = so.offer_id
				where so.solution_id = any(cast(:solutionIds as uuid[]))
				order by so.solution_id, lower(o.title), o.id
				""")
			// A PostgreSQL array literal: an identifier holds no character that needs quoting.
			.param("solutionIds", solutionIds.stream().map(UUID::toString).collect(Collectors.joining(",", "{", "}")),
					Types.VARCHAR)
			.query((row, index) -> new Attached(row.getObject("solution_id", UUID.class),
					row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
					row.getString("title"), row.getString("url")))
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
				row.getString("title"), row.getString("url"), row.getInt("solutions"), row.getLong("version"),
				row.getTimestamp("updated_at").toInstant());
	}
}
