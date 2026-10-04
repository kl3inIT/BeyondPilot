package ai.genaifund.beyondpilot.program.persistence;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.program.dto.AdminProgramSummaryResponse;
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

	/** Every program in any status, the newest first. */
	public List<AdminProgramSummaryResponse> all() {
		return jdbc.sql("""
				select id, slug, name, type, partner_name, status, starts_on, ends_on, updated_at
				from program
				order by created_at desc, id
				""")
			.query((row, index) -> new AdminProgramSummaryResponse(row.getObject("id", UUID.class),
					row.getString("slug"), row.getString("name"), row.getString("type"),
					row.getString("partner_name"), row.getString("status"), day(row.getDate("starts_on")),
					day(row.getDate("ends_on")), row.getTimestamp("updated_at").toInstant()))
			.list();
	}

	private static @Nullable LocalDate day(@Nullable Date date) {
		return date == null ? null : date.toLocalDate();
	}
}
