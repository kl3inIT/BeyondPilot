package ai.genaifund.beyondpilot.program.persistence;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.program.ProgramPhase;
import ai.genaifund.beyondpilot.program.dto.AdminProgramSummaryResponse;
import ai.genaifund.beyondpilot.program.dto.ProgramApplications;
import ai.genaifund.beyondpilot.program.dto.ProgramEventEntry;
import ai.genaifund.beyondpilot.program.dto.ProgramSummaryResponse;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The lists of programs, read as projections. */
@Repository
public class ProgramQueryRepository {

	private final JdbcClient jdbc;

	ProgramQueryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** The phases in the order the operators' list shows them: what needs them now, then what comes, then what is over. */
	private static final List<String> BY_URGENCY = List.of(ProgramPhase.OPEN.code(), ProgramPhase.RUNNING.code(),
			ProgramPhase.UPCOMING.code(), ProgramPhase.DONE.code());

	/**
	 * Every program in any status, each with the phase it would be in at {@code now}: those taking applications first,
	 * then those running, coming up and done. Inside a phase the latest to start is first, and a program with no start
	 * day comes before those, the newest created first.
	 */
	public List<AdminProgramSummaryResponse> all(Instant now) {
		return jdbc.sql("""
				select id, slug, name, type, partner_name, cover_file_id, featured_at, status, starts_on, ends_on, applications_open_at,
				       applications_close_at, shortlist_size, outcomes_due_on, allow_updates_until_close,
				       applications_open_title, applications_close_title, outcomes_due_title, updated_at
				from program
				order by starts_on desc nulls first, created_at desc, id
				""").query((row, index) -> {
			Instant opensAt = instant(row.getTimestamp("applications_open_at"));
			Instant closesAt = instant(row.getTimestamp("applications_close_at"));
			LocalDate startsOn = day(row.getDate("starts_on"));
			LocalDate endsOn = day(row.getDate("ends_on"));
			return new AdminProgramSummaryResponse(row.getObject("id", UUID.class), row.getString("slug"),
					row.getString("name"), row.getString("type"), row.getString("partner_name"),
					row.getObject("cover_file_id", UUID.class), instant(row.getTimestamp("featured_at")),
					row.getString("status"), ProgramPhase.of(startsOn, endsOn, opensAt, closesAt, now).code(),
					applications(row, opensAt, closesAt), startsOn, endsOn, row.getTimestamp("updated_at").toInstant());
		}).list().stream().sorted(Comparator.comparingInt(program -> BY_URGENCY.indexOf(program.phase()))).toList();
	}

	/**
	 * The published programs, the latest to start first, each with the phase it is in at {@code now} and its events
	 * still to come. Asked for the featured ones only, the most recently featured comes first.
	 * @param type only programs of this type, or every type when null
	 * @param featured only the featured programs when true, only the others when false, both when null
	 */
	public List<ProgramSummaryResponse> published(@Nullable String type, @Nullable Boolean featured, Instant now) {
		Map<UUID, List<ProgramEventEntry>> events = upcomingEvents(now);
		return jdbc.sql("""
				select id, slug, name, type, partner_name, summary, cover_file_id, starts_on, ends_on, page_kind,
				       external_url, applications_open_at, applications_close_at, shortlist_size, outcomes_due_on,
				       allow_updates_until_close, applications_open_title, applications_close_title, outcomes_due_title
				from program
				where status = 'published' and (cast(:type as text) is null or type = :type)
				  and (cast(:featured as boolean) is null or (featured_at is not null) = :featured)
				order by case when cast(:featured as boolean) then featured_at end desc nulls last,
				         starts_on desc nulls last, created_at desc, id
				""").param("type", type, Types.VARCHAR).param("featured", featured, Types.BOOLEAN).query((row, index) -> {
			Instant opensAt = instant(row.getTimestamp("applications_open_at"));
			Instant closesAt = instant(row.getTimestamp("applications_close_at"));
			LocalDate startsOn = day(row.getDate("starts_on"));
			LocalDate endsOn = day(row.getDate("ends_on"));
			return new ProgramSummaryResponse(row.getString("slug"), row.getString("name"), row.getString("type"),
					row.getString("partner_name"), row.getString("summary"), row.getObject("cover_file_id", UUID.class),
					ProgramPhase.of(startsOn, endsOn, opensAt, closesAt, now).code(), startsOn, endsOn,
					row.getString("page_kind"), row.getString("external_url"), applications(row, opensAt, closesAt),
					events.getOrDefault(row.getObject("id", UUID.class), List.of()));
		}).list();
	}

	/** The events still to come of every published program, soonest first, at most three a program. */
	private Map<UUID, List<ProgramEventEntry>> upcomingEvents(Instant now) {
		record Row(UUID programId, ProgramEventEntry event) {
		}
		return jdbc.sql("""
				select program_id, title, starts_at, ends_at, online, city, country, registration_url
				from (select e.*, row_number() over (partition by e.program_id order by e.starts_at, e.position) as n
				      from program_event e join program p on p.id = e.program_id
				      where p.status = 'published' and coalesce(e.ends_at, e.starts_at) >= :now) upcoming
				where n <= 3
				order by program_id, starts_at
				""")
			.param("now", Timestamp.from(now))
			.query((row, index) -> new Row(row.getObject("program_id", UUID.class),
					new ProgramEventEntry(row.getString("title"), row.getTimestamp("starts_at").toInstant(),
							instant(row.getTimestamp("ends_at")), row.getBoolean("online"), row.getString("city"),
							row.getString("country"), row.getString("registration_url"))))
			.list()
			.stream()
			.collect(Collectors.groupingBy(Row::programId,
					Collectors.mapping(Row::event, Collectors.toList())));
	}

	private static @Nullable ProgramApplications applications(ResultSet row, @Nullable Instant opensAt,
			@Nullable Instant closesAt) throws SQLException {
		if (opensAt == null || closesAt == null) {
			return null;
		}
		int shortlistSize = row.getInt("shortlist_size");
		return new ProgramApplications(opensAt, closesAt, row.wasNull() ? null : shortlistSize,
				day(row.getDate("outcomes_due_on")), row.getBoolean("allow_updates_until_close"),
				row.getString("applications_open_title"), row.getString("applications_close_title"),
				row.getString("outcomes_due_title"));
	}

	private static @Nullable Instant instant(@Nullable Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

	private static @Nullable LocalDate day(@Nullable Date date) {
		return date == null ? null : date.toLocalDate();
	}
}
