package ai.genaifund.beyondpilot.organization.persistence;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The lists of organizations, read as projections. */
@Repository
public class OrganizationQueryRepository {

	/**
	 * The organizations the operators' list selects, each with the oldest open claim on it and the organization it was
	 * merged into. A merged one is listed only when merged ones are asked for.
	 */
	private static final String ADMIN_SOURCE = """
			from organization o
			left join organization k on k.id = o.merged_into_id
			left join lateral (select r.id, r.account_id, r.created_at
			                   from organization_join_request r
			                   where r.organization_id = o.id and r.status = 'pending' and r.claim
			                   order by r.created_at, r.id
			                   limit 1) c on true
			where (cast(:pattern as text) is null or lower(o.name) like :pattern escape '\\'
			       or lower(o.email_domain) like :pattern escape '\\')
			  and ((cast(:status as text) is null and o.status <> 'merged')
			       or (:status = 'suspended' and o.suspended_at is not null and o.status <> 'merged')
			       or (:status = 'approved' and o.status = 'approved' and o.suspended_at is null)
			       or (:status = 'claimed' and c.id is not null and o.status <> 'merged')
			       or (:status = 'merged' and o.status = 'merged'))
			  and (cast(:country as text) is null or o.country = :country)
			""";

	private final JdbcClient jdbc;

	OrganizationQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** What a person choosing an organization to join sees of one. */
	public record Match(UUID id, String name, String type, @Nullable String country, @Nullable String emailDomain,
			@Nullable UUID logoFileId, boolean autoJoin, boolean owned) {
	}

	/**
	 * One organization in the operators' list, with the claim that waits on it when there is one.
	 * @param claimId the oldest open claim, a request to own it that operators decide; null when nobody asks
	 */
	public record AdminRow(UUID id, String slug, String name, @Nullable UUID logoFileId, String type,
			@Nullable String country, String status, @Nullable Instant suspendedAt, int members, boolean owned, UUID createdByAccountId,
			Instant createdAt, @Nullable UUID claimId, @Nullable UUID claimantAccountId,
			@Nullable Instant claimedAt, @Nullable String mergedIntoName) {
	}

	/** What another module shows of an organization, its logo included. */
	public record Name(UUID id, String slug, String name, @Nullable String country, @Nullable UUID logoFileId) {
	}

	/**
	 * The organizations, not taken down, a person may ask to join whose name contains the text, by name; at most
	 * {@code limit}. A builder on their own is one person, so nobody asks to join it.
	 */
	public List<Match> search(String text, int limit) {
		return jdbc.sql(MATCHES + """
				where o.status = 'approved' and o.suspended_at is null and o.type <> 'independent_builder'
				  and lower(o.name) like :pattern escape '\\'
				order by lower(o.name), o.id
				limit :limit
				""").param("pattern", containing(text)).param("limit", limit).query(OrganizationQueryRepository::match).list();
	}

	/**
	 * The organizations not taken down, the ones that can have use cases, by name; at most {@code limit}.
	 * @param text only those whose name contains it, ignoring case; every one when null
	 */
	public List<Name> approvedOrganizations(@Nullable String text, int limit) {
		return jdbc.sql("""
				select id, slug, name, country, logo_file_id from organization
				where status = 'approved' and suspended_at is null
				  and (cast(:pattern as text) is null or lower(name) like :pattern escape '\\')
				order by lower(name), id
				limit :limit
				""")
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("limit", limit)
			.query((row, index) -> new Name(row.getObject("id", UUID.class), row.getString("slug"),
					row.getString("name"), row.getString("country"), row.getObject("logo_file_id", UUID.class)))
			.list();
	}

	/** The organizations whose name contains the text, whatever their review says. */
	public List<UUID> idsNamed(String text) {
		return jdbc.sql("select id from organization where lower(name) like :pattern escape '\\'")
			.param("pattern", containing(text))
			.query(UUID.class)
			.list();
	}

	/**
	 * Locks up to {@code limit} organizations that V109 marked to be told they are active, oldest first. A row another
	 * transaction holds is skipped, so two instances never take the same one.
	 */
	public List<UUID> lockMarked(int limit) {
		return jdbc.sql("""
				select id from organization where activation_notice_pending
				order by created_at, id
				limit :limit
				for update skip locked
				""").param("limit", limit).query(UUID.class).list();
	}

	public void clearMarks(Collection<UUID> ids) {
		if (!ids.isEmpty()) {
			jdbc.sql("update organization set activation_notice_pending = false where id in (:ids)")
				.param("ids", ids)
				.update();
		}
	}

	public List<Name> names(Collection<UUID> ids) {
		return names(ids, "");
	}

	/** The names of those of these organizations that are approved; one taken down or in review is left out. */
	public List<Name> approvedNames(Collection<UUID> ids) {
		return names(ids, " and status = 'approved' and suspended_at is null");
	}

	private List<Name> names(Collection<UUID> ids, String condition) {
		if (ids.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("select id, slug, name, country, logo_file_id from organization where id in (:ids)" + condition)
			.param("ids", ids)
			.query((row, index) -> new Name(row.getObject("id", UUID.class), row.getString("slug"),
					row.getString("name"), row.getString("country"), row.getObject("logo_file_id", UUID.class)))
			.list();
	}

	/**
	 * One page for operators in the order {@code sort} names; without one, those with an open claim first, then the
	 * newest.
	 * @param status {@code approved} for those not taken down, {@code claimed} for those with an open claim,
	 * {@code suspended} for those taken down or {@code merged}; none selects every one but the merged
	 * @param sort {@code name}, {@code received} or {@code members}, with {@code -} before it for the reverse
	 */
	public List<AdminRow> adminPage(@Nullable String text, @Nullable String status, @Nullable String country,
			@Nullable String sort, int limit, long offset) {
		return adminFiltered("""
				select o.id, o.slug, o.name, o.logo_file_id, o.type, o.country, o.status, o.suspended_at, o.created_by_account_id,
				       o.created_at,
				       (select count(*) from organization_member m where m.organization_id = o.id) as members,
				       exists (select 1 from organization_member m
				               where m.organization_id = o.id and m.role = 'owner') as owned,
				       c.id as claim_id, c.account_id as claimant_account_id, c.created_at as claimed_at,
				       k.name as merged_into_name
				""" + ADMIN_SOURCE + "order by " + adminOrder(sort) + "\nlimit :limit offset :offset\n", text, status, country).param("limit", limit).param("offset", offset).query((row, index) -> {
			Timestamp claimedAt = row.getTimestamp("claimed_at");
			Timestamp suspendedAt = row.getTimestamp("suspended_at");
			return new AdminRow(row.getObject("id", UUID.class), row.getString("slug"), row.getString("name"),
					row.getObject("logo_file_id", UUID.class), row.getString("type"), row.getString("country"),
					row.getString("status"), suspendedAt == null ? null : suspendedAt.toInstant(), row.getInt("members"), row.getBoolean("owned"),
					row.getObject("created_by_account_id", UUID.class), row.getTimestamp("created_at").toInstant(),
					row.getObject("claim_id", UUID.class), row.getObject("claimant_account_id", UUID.class),
					claimedAt == null ? null : claimedAt.toInstant(), row.getString("merged_into_name"));
		}).list();
	}

	public long adminCount(@Nullable String text, @Nullable String status, @Nullable String country) {
		return adminFiltered("select count(*)\n" + ADMIN_SOURCE, text, status, country).query(Long.class)
			.single();
	}

	/**
	 * The order a sort key names, with the identifier last so that pages do not overlap. The SQL is chosen here by the
	 * key, never taken from the caller's text; an unknown key keeps the default order.
	 */
	private static String adminOrder(@Nullable String sort) {
		boolean descending = sort != null && sort.startsWith("-");
		String key = sort == null ? "" : sort.substring(descending ? 1 : 0);
		String direction = descending ? " desc" : "";
		return switch (key) {
			case "name" -> "lower(o.name)" + direction + ", o.id";
			case "received" -> "coalesce(c.created_at, o.created_at)" + direction + ", o.id";
			case "members" -> "members" + direction + ", lower(o.name), o.id";
			default -> "case when c.id is not null then 0 else 1 end, "
					+ "coalesce(c.created_at, o.created_at) desc, o.id";
		};
	}

	/** The countries the operators' list can be narrowed by: those an organization that is not merged is in. */
	public List<String> adminCountries() {
		return jdbc.sql("""
				select distinct country from organization
				where country is not null and status <> 'merged'
				order by country
				""").query(String.class).list();
	}

	private JdbcClient.StatementSpec adminFiltered(String sql, @Nullable String text, @Nullable String status,
			@Nullable String country) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("status", status, Types.VARCHAR)
			.param("country", country, Types.VARCHAR);
	}

	private static final String MATCHES = """
			select o.id, o.name, o.type, o.country, o.email_domain, o.logo_file_id, o.auto_join,
			       exists (select 1 from organization_member m
			               where m.organization_id = o.id and m.role = 'owner') as owned
			from organization o
			""";

	private static Match match(ResultSet row, int index) throws SQLException {
		return new Match(row.getObject("id", UUID.class), row.getString("name"), row.getString("type"),
				row.getString("country"), row.getString("email_domain"), row.getObject("logo_file_id", UUID.class),
				row.getBoolean("auto_join"),
				row.getBoolean("owned"));
	}

	private static List<String> strings(Array array) throws SQLException {
		return List.of((String[]) array.getArray());
	}

	/** A pattern that matches the text anywhere, with the characters LIKE gives a meaning taken literally. */
	private static String containing(String text) {
		String literal = text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + literal + "%";
	}

	/**
	 * How many ownership claims were open at the end of each of the 14 days up to {@code today} in Vietnam, oldest
	 * first: made by then and not decided by then.
	 */
	public List<Long> organizationsWaitingByDay(LocalDate today) {
		return jdbc.sql("""
				select (select count(distinct r.organization_id)
				        from organization_join_request r
				        where r.claim and r.created_at < day.ends
				          and (r.status = 'pending' or r.decided_at >= day.ends))
				from (select (d + interval '1 day') at time zone 'Asia/Ho_Chi_Minh' as ends
				      from generate_series(cast(:today as timestamp) - interval '13 days', cast(:today as timestamp),
				                           interval '1 day') as d) as day
				order by day.ends
				""")
			.param("today", today.toString())
			.query(Long.class)
			.list();
	}

	/** When the claim that has waited longest was made; null when none waits. */
	public @Nullable Instant organizationsOldestWaiting() {
		return jdbc.sql("""
				select min(created_at) from organization_join_request where claim and status = 'pending'
				""")
			.query(Timestamp.class)
			.optional()
			.map(Timestamp::toInstant)
			.orElse(null);
	}

}
