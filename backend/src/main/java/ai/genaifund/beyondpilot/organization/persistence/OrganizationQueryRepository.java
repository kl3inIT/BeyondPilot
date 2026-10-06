package ai.genaifund.beyondpilot.organization.persistence;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationSummaryResponse;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The lists of organizations, read as projections. */
@Repository
public class OrganizationQueryRepository {

	private static final String ADMIN_FILTER = """
			where (cast(:pattern as text) is null or lower(o.name) like :pattern escape '\\'
			       or lower(o.email_domain) like :pattern escape '\\')
			  and (cast(:status as text) is null or o.status = :status)
			""";

	private final JdbcClient jdbc;

	OrganizationQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** What a person choosing an organization to join sees of one. */
	public record Match(UUID id, String name, String type, @Nullable String country, @Nullable String emailDomain,
			boolean autoJoin, boolean owned) {
	}

	/** What another module shows of an organization. */
	public record Name(UUID id, String slug, String name, @Nullable String country) {
	}

	/** The approved organizations whose name contains the text, by name; at most {@code limit}. */
	public List<Match> search(String text, int limit) {
		return jdbc.sql(MATCHES + """
				where o.status = 'approved' and lower(o.name) like :pattern escape '\\'
				order by lower(o.name), o.id
				limit :limit
				""").param("pattern", containing(text)).param("limit", limit).query(OrganizationQueryRepository::match).list();
	}

	/**
	 * The approved organizations with the enterprise role, the ones that can have use cases, by name; at most
	 * {@code limit}.
	 * @param text only those whose name contains it, ignoring case; every one when null
	 */
	public List<Name> approvedEnterprises(@Nullable String text, int limit) {
		return jdbc.sql("""
				select id, slug, name, country from organization
				where status = 'approved' and 'enterprise' = any(roles)
				  and (cast(:pattern as text) is null or lower(name) like :pattern escape '\\')
				order by lower(name), id
				limit :limit
				""")
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("limit", limit)
			.query((row, index) -> new Name(row.getObject("id", UUID.class), row.getString("slug"),
					row.getString("name"), row.getString("country")))
			.list();
	}

	public List<Name> names(Collection<UUID> ids) {
		if (ids.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("select id, slug, name, country from organization where id in (:ids)")
			.param("ids", ids)
			.query((row, index) -> new Name(row.getObject("id", UUID.class), row.getString("slug"),
					row.getString("name"), row.getString("country")))
			.list();
	}

	/** One page for operators: those waiting for review first, then the newest. */
	public List<AdminOrganizationSummaryResponse> adminPage(@Nullable String text, @Nullable String status, int limit,
			long offset) {
		return adminFiltered("""
				select o.id, o.slug, o.name, o.roles, o.type, o.country, o.status, o.created_at,
				       (select count(*) from organization_member m where m.organization_id = o.id) as members,
				       (select count(*) from organization_member m
				        where m.organization_id = o.id and m.role = 'owner') as owners,
				       (select count(*) from organization_join_request r
				        where r.organization_id = o.id and r.status = 'pending') as requests
				from organization o
				""" + ADMIN_FILTER + """
				order by case o.status when 'pending' then 0 else 1 end, o.created_at desc, o.id
				limit :limit offset :offset
				""", text, status).param("limit", limit).param("offset", offset).query((row, index) -> {
			boolean owned = row.getInt("owners") > 0;
			return new AdminOrganizationSummaryResponse(row.getObject("id", UUID.class), row.getString("slug"),
					row.getString("name"), strings(row.getArray("roles")), row.getString("type"),
					row.getString("country"), row.getString("status"), row.getInt("members"), owned,
					// A request to an organization nobody owns is a claim, which operators decide.
					owned ? 0 : row.getInt("requests"), row.getTimestamp("created_at").toInstant());
		}).list();
	}

	public long adminCount(@Nullable String text, @Nullable String status) {
		return adminFiltered("select count(*) from organization o\n" + ADMIN_FILTER, text, status).query(Long.class)
			.single();
	}

	private JdbcClient.StatementSpec adminFiltered(String sql, @Nullable String text, @Nullable String status) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("status", status, Types.VARCHAR);
	}

	private static final String MATCHES = """
			select o.id, o.name, o.type, o.country, o.email_domain, o.auto_join,
			       exists (select 1 from organization_member m
			               where m.organization_id = o.id and m.role = 'owner') as owned
			from organization o
			""";

	private static Match match(ResultSet row, int index) throws SQLException {
		return new Match(row.getObject("id", UUID.class), row.getString("name"), row.getString("type"),
				row.getString("country"), row.getString("email_domain"), row.getBoolean("auto_join"),
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
}
