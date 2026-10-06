package ai.genaifund.beyondpilot.talent.persistence;

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

/** The lists of profiles, read as projections: the public directory and the operators' queue. */
@Repository
public class TalentQueryRepository {

	private static final String PUBLIC_FILTER = """
			where status = 'approved' and listed
			  and (cast(:pattern as text) is null or lower(name) like :pattern escape '\\'
			       or lower(headline) like :pattern escape '\\'
			       or exists (select 1 from unnest(skills) skill where lower(skill) like :pattern escape '\\')
			       or exists (select 1 from talent_project p
			                  where p.profile_id = talent_profile.id and lower(p.title) like :pattern escape '\\'))
			  and (cast(:role as text) is null or roles @> array[cast(:role as text)])
			  and (cast(:country as text) is null or country = :country)
			  and (cast(:industry as text) is null or industries @> array[cast(:industry as text)])
			  and (cast(:engagement as text) is null or engagement @> array[cast(:engagement as text)])
			""";

	private static final String ADMIN_FILTER = """
			where status <> 'draft'
			  and (cast(:pattern as text) is null or lower(name) like :pattern escape '\\')
			  and (cast(:status as text) is null or status = :status)
			""";

	private static final String ROW = """
			select id, account_id, slug, name, headline, roles, skills, country, city, status, listed,
			       submitted_at, updated_at, photo_file_id,
			       (select count(*) from talent_project p where p.profile_id = talent_profile.id) as project_count,
			       (select array[p.title, p.stage] from talent_project p where p.profile_id = talent_profile.id
			        order by p.position limit 1) as lead_project
			from talent_profile
			""";

	private final JdbcClient jdbc;

	TalentQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * One profile in a list.
	 * @param leadTitle the title of the first project the profile shows; null when it shows none
	 * @param leadStage how far that project went; null when not stated
	 */
	public record Row(UUID id, UUID accountId, String slug, String name, @Nullable String headline, List<String> roles,
			List<String> skills, @Nullable String country, @Nullable String city, String status, boolean listed,
			@Nullable Instant submittedAt, Instant updatedAt, @Nullable UUID photoFileId, int projectCount,
			@Nullable String leadTitle, @Nullable String leadStage) {
	}

	/** What narrows the public directory; a null member narrows nothing. */
	public record PublicFilter(@Nullable String text, @Nullable String role, @Nullable String country,
			@Nullable String industry, @Nullable String engagement) {
	}

	/** One page of the public directory, by name or with the most recently approved first. */
	public List<Row> publicPage(PublicFilter filter, @Nullable String sort, int limit, long offset) {
		return publicFiltered(ROW + PUBLIC_FILTER + publicOrder(sort) + " limit :limit offset :offset", filter)
			.param("limit", limit)
			.param("offset", offset)
			.query(TalentQueryRepository::row)
			.list();
	}

	public long publicCount(PublicFilter filter) {
		return publicFiltered("select count(*) from talent_profile\n" + PUBLIC_FILTER, filter).query(Long.class)
			.single();
	}

	/** One page for operators, drafts left out: those waiting for review first, the longest wait on top. */
	public List<Row> adminPage(@Nullable String text, @Nullable String status, int limit, long offset) {
		return adminFiltered(ROW + ADMIN_FILTER + """
				order by case status when 'submitted' then 0 else 1 end, submitted_at, id
				limit :limit offset :offset
				""", text, status).param("limit", limit).param("offset", offset).query(TalentQueryRepository::row).list();
	}

	public long adminCount(@Nullable String text, @Nullable String status) {
		return adminFiltered("select count(*) from talent_profile\n" + ADMIN_FILTER, text, status).query(Long.class)
			.single();
	}

	/** The orders of the public directory. The value is never the caller's text: it is chosen here by its name. */
	private static String publicOrder(@Nullable String sort) {
		return "newest".equals(sort) ? "order by decided_at desc nulls last, id" : "order by lower(name), id";
	}

	private JdbcClient.StatementSpec publicFiltered(String sql, PublicFilter filter) {
		return jdbc.sql(sql)
			.param("pattern", filter.text() == null ? null : containing(filter.text()), Types.VARCHAR)
			.param("role", filter.role(), Types.VARCHAR)
			.param("country", filter.country(), Types.VARCHAR)
			.param("industry", filter.industry(), Types.VARCHAR)
			.param("engagement", filter.engagement(), Types.VARCHAR);
	}

	private JdbcClient.StatementSpec adminFiltered(String sql, @Nullable String text, @Nullable String status) {
		return jdbc.sql(sql)
			.param("pattern", text == null ? null : containing(text), Types.VARCHAR)
			.param("status", status, Types.VARCHAR);
	}

	private static Row row(ResultSet row, int index) throws SQLException {
		Timestamp submittedAt = row.getTimestamp("submitted_at");
		Array lead = row.getArray("lead_project");
		String[] leadProject = lead == null ? new String[2] : (String[]) lead.getArray();
		return new Row(row.getObject("id", UUID.class), row.getObject("account_id", UUID.class), row.getString("slug"),
				row.getString("name"), row.getString("headline"), strings(row.getArray("roles")),
				strings(row.getArray("skills")), row.getString("country"), row.getString("city"), row.getString("status"),
				row.getBoolean("listed"), submittedAt == null ? null : submittedAt.toInstant(),
				row.getTimestamp("updated_at").toInstant(), row.getObject("photo_file_id", UUID.class),
				row.getInt("project_count"), leadProject[0], leadProject[1]);
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
