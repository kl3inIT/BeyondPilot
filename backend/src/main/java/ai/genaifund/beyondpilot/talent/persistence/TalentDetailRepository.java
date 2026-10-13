package ai.genaifund.beyondpilot.talent.persistence;

import java.sql.Types;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The projects a profile shows. The rows are small and change by single statements, so they are written here and not
 * through entities.
 */
@Repository
public class TalentDetailRepository {

	private final JdbcClient jdbc;

	TalentDetailRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One project a profile shows. */
	public record Project(String title, @Nullable String summary, @Nullable String url, @Nullable Integer year,
			@Nullable String stage) {
	}

	/** The projects of a profile, in the order the person put them. */
	public List<Project> projects(UUID profileId) {
		return jdbc
			.sql("select title, summary, url, year, stage from talent_project where profile_id = ? order by position")
			.param(profileId)
			.query((row, index) -> new Project(row.getString("title"), row.getString("summary"), row.getString("url"),
					row.getObject("year", Integer.class), row.getString("stage")))
			.list();
	}

	/** Puts these projects in the place of the ones the profile had. */
	public void replaceProjects(UUID profileId, List<Project> projects) {
		jdbc.sql("delete from talent_project where profile_id = ?").param(profileId).update();
		for (int position = 0; position < projects.size(); position++) {
			Project project = projects.get(position);
			jdbc.sql("""
					insert into talent_project (id, profile_id, position, title, summary, url, year, stage)
					values (:id, :profileId, :position, :title, :summary, :url, :year, :stage)
					""")
				.param("id", UUID.randomUUID())
				.param("profileId", profileId)
				.param("position", position)
				.param("title", project.title())
				.param("summary", project.summary(), Types.VARCHAR)
				.param("url", project.url(), Types.VARCHAR)
				.param("year", project.year(), Types.INTEGER)
				.param("stage", project.stage(), Types.VARCHAR)
				.update();
		}
	}
}
