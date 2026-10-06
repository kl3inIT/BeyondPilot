package ai.genaifund.beyondpilot.usecase.persistence;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The list of use cases, read as a projection. */
@Repository
public class UseCaseQueryRepository {

	/** The status as a reader sees it at a moment: closed from the close date on, whatever is stored. */
	private static final String STATUS_AT_NOW = "case when closes_at <= :now then 'closed' else status end";

	/** The text matches a title, or an organization the caller found by name; the organization is exact. */
	private static final String FILTER = "where (cast(:pattern as text) is null or lower(title) like :pattern escape '\\'\n"
			+ "       or organization_id::text = any(:matching))\n"
			+ "  and (cast(:organization as text) is null or organization_id::text = :organization)\n"
			+ "  and (cast(:status as text) is null or " + STATUS_AT_NOW + " = :status)\n";

	private final JdbcClient jdbc;

	UseCaseQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** What the operators' list shows of one use case; the organization is named by its own module. */
	public record Row(UUID id, UUID organizationId, @Nullable String title, String status, @Nullable Instant closesAt,
			Instant updatedAt) {
	}

	/** One page, the newest first. */
	public List<Row> page(@Nullable String text, List<UUID> matching, @Nullable UUID organization, @Nullable String status,
			Instant now, int limit, long offset) {
		return filtered("select id, organization_id, title, " + STATUS_AT_NOW
				+ " as status, closes_at, updated_at from use_case\n" + FILTER
				+ "order by created_at desc, id limit :limit offset :offset", text, matching, organization, status,
				now)
			.param("limit", limit)
			.param("offset", offset)
			.query((row, index) -> new Row(row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
					row.getString("title"), row.getString("status"), instantOf(row.getTimestamp("closes_at")),
					row.getTimestamp("updated_at").toInstant()))
			.list();
	}

	/** How many use cases match, over all pages. */
	public long count(@Nullable String text, List<UUID> matching, @Nullable UUID organization, @Nullable String status,
			Instant now) {
		return filtered("select count(*) from use_case\n" + FILTER, text, matching, organization, status, now)
			.query(Long.class)
			.single();
	}

	/** How many use cases wait for GenAI Fund, over the whole system. */
	public long inReview(Instant now) {
		return jdbc.sql("select count(*) from use_case where status = 'in_review' and (closes_at is null or closes_at > :now)")
			.param("now", Timestamp.from(now))
			.query(Long.class)
			.single();
	}

	private JdbcClient.StatementSpec filtered(String sql, @Nullable String text, List<UUID> matching,
			@Nullable UUID organization, @Nullable String status, Instant now) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("matching", matching.stream().map(UUID::toString).toArray(String[]::new))
			.param("organization", organization == null ? null : organization.toString(), Types.VARCHAR)
			.param("status", status, Types.VARCHAR)
			.param("now", Timestamp.from(now));
	}

	private static @Nullable Instant instantOf(@Nullable Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

	/** A pattern that matches the text anywhere, with the characters LIKE gives a meaning taken literally. */
	private static String containing(String text) {
		String literal = text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + literal + "%";
	}
}
