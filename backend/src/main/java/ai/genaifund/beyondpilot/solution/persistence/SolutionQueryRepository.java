package ai.genaifund.beyondpilot.solution.persistence;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The lists of solutions, read as projections: the public directory and the operators' queue. */
@Repository
public class SolutionQueryRepository {

	private static final String PUBLIC_FILTER = """
			where status = 'approved' and listed
			  and (cast(:pattern as text) is null or lower(name) like :pattern escape '\\'
			       or lower(summary) like :pattern escape '\\')
			  and (cast(:industry as text) is null or industries @> array[cast(:industry as text)])
			  and (cast(:focusArea as text) is null or focus_areas @> array[cast(:focusArea as text)])
			  and (cast(:maturity as text) is null or maturity = :maturity)
			  and (cast(:organizationId as uuid) is null or organization_id = :organizationId)
			""";

	private static final String ADMIN_FILTER = """
			where status <> 'draft'
			  and (cast(:pattern as text) is null or lower(name) like :pattern escape '\\')
			  and (cast(:status as text) is null or status = :status)
			""";

	private static final String ROW = """
			select id, organization_id, slug, name, summary, focus_areas, industries, maturity, status, listed,
			       submitted_at, updated_at,
			       (select count(*) from solution_customer_deployment d
			        where d.solution_id = solution.id and d.status = 'approved') as deployments,
			       (select count(*) from solution_customer_deployment d
			        where d.solution_id = solution.id and d.status = 'submitted') as deployments_awaiting
			from solution
			""";

	private final JdbcClient jdbc;

	SolutionQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One solution in a list, with how many of its customer deployments are approved and how many wait for review. */
	public record Row(UUID id, UUID organizationId, String slug, String name, @Nullable String summary,
			List<String> focusAreas, List<String> industries, @Nullable String maturity, String status, boolean listed,
			@Nullable Instant submittedAt, Instant updatedAt, int deployments, int deploymentsAwaiting) {
	}

	/** One page of the public directory, by name or with the most recently approved first. */
	public List<Row> publicPage(@Nullable String text, @Nullable String industry, @Nullable String focusArea,
			@Nullable String maturity, @Nullable UUID organizationId, @Nullable String sort, int limit, long offset) {
		return publicFiltered(ROW + PUBLIC_FILTER + publicOrder(sort) + " limit :limit offset :offset", text, industry,
				focusArea, maturity, organizationId)
			.param("limit", limit)
			.param("offset", offset)
			.query(SolutionQueryRepository::row)
			.list();
	}

	public long publicCount(@Nullable String text, @Nullable String industry, @Nullable String focusArea,
			@Nullable String maturity, @Nullable UUID organizationId) {
		return publicFiltered("select count(*) from solution\n" + PUBLIC_FILTER, text, industry, focusArea, maturity,
				organizationId)
			.query(Long.class)
			.single();
	}

	/**
	 * One page for operators, drafts left out: those with something waiting for review first, the solution itself or
	 * one of its customer deployments, the longest wait on top.
	 */
	public List<Row> adminPage(@Nullable String text, @Nullable String status, int limit, long offset) {
		return adminFiltered(ROW + ADMIN_FILTER + """
				order by case when status = 'submitted' or exists (
				             select 1 from solution_customer_deployment d
				             where d.solution_id = solution.id and d.status = 'submitted') then 0 else 1 end,
				         submitted_at, id
				limit :limit offset :offset
				""", text, status).param("limit", limit).param("offset", offset).query(SolutionQueryRepository::row).list();
	}

	public long adminCount(@Nullable String text, @Nullable String status) {
		return adminFiltered("select count(*) from solution\n" + ADMIN_FILTER, text, status).query(Long.class).single();
	}

	/** The orders of the public directory. The value is never the caller's text: it is chosen here by its name. */
	private static String publicOrder(@Nullable String sort) {
		return "newest".equals(sort) ? "order by decided_at desc nulls last, id" : "order by lower(name), id";
	}

	private JdbcClient.StatementSpec publicFiltered(String sql, @Nullable String text, @Nullable String industry,
			@Nullable String focusArea, @Nullable String maturity, @Nullable UUID organizationId) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("industry", industry, Types.VARCHAR)
			.param("focusArea", focusArea, Types.VARCHAR)
			.param("maturity", maturity, Types.VARCHAR)
			.param("organizationId", organizationId, Types.OTHER);
	}

	private JdbcClient.StatementSpec adminFiltered(String sql, @Nullable String text, @Nullable String status) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("status", status, Types.VARCHAR);
	}

	private static Row row(ResultSet row, int index) throws SQLException {
		Timestamp submittedAt = row.getTimestamp("submitted_at");
		return new Row(row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
				row.getString("slug"), row.getString("name"), row.getString("summary"),
				strings(row.getArray("focus_areas")), strings(row.getArray("industries")), row.getString("maturity"),
				row.getString("status"), row.getBoolean("listed"),
				submittedAt == null ? null : submittedAt.toInstant(), row.getTimestamp("updated_at").toInstant(),
				row.getInt("deployments"), row.getInt("deployments_awaiting"));
	}

	private static List<String> strings(Array array) throws SQLException {
		return List.of((String[]) array.getArray());
	}

	/** A pattern that matches the text anywhere, with the characters LIKE gives a meaning taken literally. */
	private static String containing(String text) {
		String literal = text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + literal + "%";
	}
}
