package ai.genaifund.beyondpilot.usecase.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
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
			+ "  and (cast(:status as text) is null or " + STATUS_AT_NOW + " = :status)\n"
			+ "  and (cast(:featured as boolean) is null or (featured_at is not null) = :featured)\n";

	private final JdbcClient jdbc;

	UseCaseQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Gives the use cases of a merged organization to the one kept. Each version moves on, so a save read before the
	 * merge is refused instead of writing the former organization back.
	 */
	public void moveToOrganization(UUID from, UUID into) {
		jdbc.sql("update use_case set organization_id = ?, version = version + 1 where organization_id = ?")
			.params(into, from)
			.update();
	}

	/** What the operators' list shows of one use case; the organization is named by its own module. */
	public record Row(UUID id, UUID organizationId, @Nullable String title, String status, @Nullable Instant closesAt,
			@Nullable Instant featuredAt, Instant updatedAt) {
	}

	/**
	 * One page in the order {@code sort} names; without one, the newest first.
	 * @param sort {@code title}, {@code closes} or {@code updated}, with {@code -} before it for the reverse
	 */
	public List<Row> page(@Nullable String text, List<UUID> matching, @Nullable UUID organization, @Nullable String status,
			@Nullable Boolean featured, @Nullable String sort, Instant now, int limit, long offset) {
		return filtered("select id, organization_id, title, " + STATUS_AT_NOW
				+ " as status, closes_at, featured_at, updated_at from use_case\n" + FILTER + "order by " + order(sort)
				+ " limit :limit offset :offset", text, matching, organization, status, featured, now)
			.param("limit", limit)
			.param("offset", offset)
			.query((row, index) -> new Row(row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
					row.getString("title"), row.getString("status"), instantOf(row.getTimestamp("closes_at")),
					instantOf(row.getTimestamp("featured_at")), row.getTimestamp("updated_at").toInstant()))
			.list();
	}

	/**
	 * The operators' order a sort key names, with the identifier last so that pages do not overlap. The SQL is chosen
	 * here by the key, never taken from the caller's text; an unknown key keeps the default order.
	 */
	private static String order(@Nullable String sort) {
		boolean descending = sort != null && sort.startsWith("-");
		String key = sort == null ? "" : sort.substring(descending ? 1 : 0);
		String direction = descending ? " desc" : "";
		return switch (key) {
			case "title" -> "lower(title)" + direction + " nulls last, id";
			case "closes" -> "closes_at" + direction + " nulls last, id";
			case "updated" -> "updated_at" + direction + ", id";
			default -> "created_at desc, id";
		};
	}

	/** How many use cases match, over all pages. */
	public long count(@Nullable String text, List<UUID> matching, @Nullable UUID organization, @Nullable String status,
			@Nullable Boolean featured, Instant now) {
		return filtered("select count(*) from use_case\n" + FILTER, text, matching, organization, status, featured, now)
			.query(Long.class)
			.single();
	}

	/**
	 * Published use cases, including those past their proposal deadline. The text matches a title or the expected
	 * outcomes, or an organization the caller found by name that did not ask to stay anonymous.
	 */
	private static final String PUBLIC_FILTER = "where status = 'approved' and published_at is not null\n"
			+ "  and (cast(:proposalStatus as text) is null\n"
			+ "       or (:proposalStatus = 'open' and (closes_at is null or closes_at > :now))\n"
			+ "       or (:proposalStatus = 'closed' and closes_at <= :now))\n"
			+ "  and (cast(:pattern as text) is null or lower(title) like :pattern escape '\\'\n"
			+ "       or lower(expected_outcomes) like :pattern escape '\\'\n"
			+ "       or (not hide_organization_name and organization_id::text = any(:matching)))\n"
			+ "  and (cast(:industries as text[]) is null or industry = any(:industries))\n"
			+ "  and (cast(:program as text) is null or exists (select 1 from use_case_program p\n"
			+ "       where p.use_case_id = use_case.id and p.program_id::text = :program))\n";

	/** What the public list shows of one use case; the organization is named by its own module. */
	public record PublicRow(UUID id, UUID organizationId, boolean hideOrganizationName, String title, String industry,
			String goal, List<String> technologies, @Nullable Long budgetMin, @Nullable Long budgetMax, String currency,
			boolean budgetToBeDetermined, boolean budgetMembersOnly, @Nullable Integer timelineMinWeeks,
			@Nullable Integer timelineMaxWeeks, @Nullable Instant closesAt, Instant publishedAt,
			@Nullable Instant featuredAt) {
	}

	/**
	 * One page of the public list; {@code sort} is newest, deadline or budget. A budget in đồng orders as its value in
	 * US dollars at {@code vndPerUsd}, which no reader sees. With {@code featuredFirst} the featured use cases come
	 * before the others, the earliest featured on top. A budget shown to members only orders the list for a
	 * {@code member} alone.
	 */
	public List<PublicRow> publicPage(@Nullable String text, List<UUID> matching, @Nullable List<String> industries,
			@Nullable UUID program, @Nullable String proposalStatus, String sort, boolean featuredFirst, boolean member,
			long vndPerUsd, Instant now, int limit, long offset) {
		String order = switch (sort) {
			case "deadline" -> "closes_at nulls last, id";
			// A budget for members only is not a number a visitor sees, so it does not order their list either.
			case "budget" -> "(case when budget_members_only and not :member then null when currency = 'VND' "
					+ "then budget_max::numeric / :vndPerUsd else budget_max end) desc nulls last, id";
			default -> "published_at desc, id";
		};
		return publicFiltered("select id, organization_id, hide_organization_name, title, industry, expected_outcomes, "
				+ "technologies, budget_min, budget_max, currency, budget_to_be_determined, budget_members_only, "
				+ "timeline_min_weeks, timeline_max_weeks, closes_at, published_at, featured_at from use_case\n"
				+ PUBLIC_FILTER + "order by case when closes_at <= :now then 1 else 0 end, "
				+ (featuredFirst ? "featured_at asc nulls last, " : "") + order + " limit :limit offset :offset",
				text, matching, industries, program, proposalStatus, now)
			.param("vndPerUsd", vndPerUsd)
			.param("member", member)
			.param("limit", limit)
			.param("offset", offset)
			.query((row, index) -> new PublicRow(row.getObject("id", UUID.class),
					row.getObject("organization_id", UUID.class), row.getBoolean("hide_organization_name"),
					row.getString("title"), row.getString("industry"), row.getString("expected_outcomes"),
					List.of((String[]) row.getArray("technologies").getArray()), longOf(row, "budget_min"),
					longOf(row, "budget_max"), row.getString("currency"), row.getBoolean("budget_to_be_determined"),
					row.getBoolean("budget_members_only"), row.getObject("timeline_min_weeks", Integer.class),
					row.getObject("timeline_max_weeks", Integer.class), instantOf(row.getTimestamp("closes_at")),
					row.getTimestamp("published_at").toInstant(), instantOf(row.getTimestamp("featured_at"))))
			.list();
	}

	/** How many use cases the public list holds for these parameters, over all pages. */
	public long publicCount(@Nullable String text, List<UUID> matching, @Nullable List<String> industries,
			@Nullable UUID program, @Nullable String proposalStatus, Instant now) {
		return publicFiltered("select count(*) from use_case\n" + PUBLIC_FILTER, text, matching, industries, program, proposalStatus, now)
			.query(Long.class)
			.single();
	}

	private JdbcClient.StatementSpec publicFiltered(String sql, @Nullable String text, List<UUID> matching,
			@Nullable List<String> industries, @Nullable UUID program, @Nullable String proposalStatus, Instant now) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("matching", matching.stream().map(UUID::toString).toArray(String[]::new))
			.param("industries", industries == null || industries.isEmpty() ? null : industries.toArray(String[]::new))
			.param("program", program == null ? null : program.toString(), Types.VARCHAR)
			.param("proposalStatus", proposalStatus, Types.VARCHAR)
			.param("now", Timestamp.from(now));
	}

	private static @Nullable Long longOf(ResultSet row, String column) throws SQLException {
		long value = row.getLong(column);
		return row.wasNull() ? null : value;
	}

	/** The organizations that hold a use case in any status, for the operators' list to filter by. */
	public List<UUID> organizationIds() {
		return jdbc.sql("select distinct organization_id from use_case order by organization_id").query(UUID.class).list();
	}

	/** How many use cases wait for GenAI Fund, over the whole system. */
	public long inReview(Instant now) {
		return jdbc.sql("select count(*) from use_case where status = 'in_review' and (closes_at is null or closes_at > :now)")
			.param("now", Timestamp.from(now))
			.query(Long.class)
			.single();
	}

	private JdbcClient.StatementSpec filtered(String sql, @Nullable String text, List<UUID> matching,
			@Nullable UUID organization, @Nullable String status, @Nullable Boolean featured, Instant now) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("matching", matching.stream().map(UUID::toString).toArray(String[]::new))
			.param("organization", organization == null ? null : organization.toString(), Types.VARCHAR)
			.param("status", status, Types.VARCHAR)
			.param("featured", featured, Types.BOOLEAN)
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

	/**
	 * How many use cases waited for review at the end of each of the 14 days up to {@code today} in Vietnam, oldest
	 * first: sent by then and not decided by then. A row keeps only its last sending and its last decision, so a day
	 * behind today is an approximation, good for a direction.
	 */
	public List<Long> useCasesWaitingByDay(LocalDate today, Instant now) {
		return jdbc.sql("""
				select (select count(*) from use_case u
				        where coalesce(u.submitted_at, u.created_at) < day.ends
				          and (u.closes_at is null or u.closes_at > least(day.ends, :now))
				          and (u.status = 'in_review' or u.reviewed_at >= day.ends))
				from (select (d + interval '1 day') at time zone 'Asia/Ho_Chi_Minh' as ends
				      from generate_series(cast(:today as timestamp) - interval '13 days', cast(:today as timestamp),
				                           interval '1 day') as d) as day
				order by day.ends
				""")
			.param("today", today.toString())
			.param("now", Timestamp.from(now))
			.query(Long.class)
			.list();
	}

	/** When the use case that has waited longest was sent; null when none waits. */
	public @Nullable Instant useCasesOldestWaiting() {
		return jdbc.sql("""
				select min(coalesce(submitted_at, created_at)) from use_case
				where status = 'in_review' and (closes_at is null or closes_at > now())
				""")
			.query(Timestamp.class)
			.optional()
			.map(Timestamp::toInstant)
			.orElse(null);
	}

}
