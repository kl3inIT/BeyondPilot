package ai.genaifund.beyondpilot.talent.persistence;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * What hangs on a profile: the projects it shows and the messages sent through it. The rows are small and change by
 * single statements, so they are written here and not through entities.
 */
@Repository
public class TalentDetailRepository {

	private final JdbcClient jdbc;

	TalentDetailRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One project a profile shows. */
	public record Project(String title, @Nullable String summary, @Nullable String url, @Nullable Integer year) {
	}

	/** One message sent through a profile. */
	public record Enquiry(UUID id, UUID senderAccountId, String message, Instant createdAt) {
	}

	/** The projects of a profile, in the order the person put them. */
	public List<Project> projects(UUID profileId) {
		return jdbc.sql("select title, summary, url, year from talent_project where profile_id = ? order by position")
			.param(profileId)
			.query((row, index) -> new Project(row.getString("title"), row.getString("summary"), row.getString("url"),
					row.getObject("year", Integer.class)))
			.list();
	}

	/** Puts these projects in the place of the ones the profile had. */
	public void replaceProjects(UUID profileId, List<Project> projects) {
		jdbc.sql("delete from talent_project where profile_id = ?").param(profileId).update();
		for (int position = 0; position < projects.size(); position++) {
			Project project = projects.get(position);
			jdbc.sql("""
					insert into talent_project (id, profile_id, position, title, summary, url, year)
					values (:id, :profileId, :position, :title, :summary, :url, :year)
					""")
				.param("id", UUID.randomUUID())
				.param("profileId", profileId)
				.param("position", position)
				.param("title", project.title())
				.param("summary", project.summary(), Types.VARCHAR)
				.param("url", project.url(), Types.VARCHAR)
				.param("year", project.year(), Types.INTEGER)
				.update();
		}
	}

	public void addEnquiry(UUID profileId, UUID senderAccountId, String message) {
		jdbc.sql("insert into talent_enquiry (id, profile_id, sender_account_id, message) values (?, ?, ?, ?)")
			.params(UUID.randomUUID(), profileId, senderAccountId, message)
			.update();
	}

	/** Whether this sender wrote through this profile after the moment given. */
	public boolean enquiredSince(UUID profileId, UUID senderAccountId, Instant since) {
		return jdbc.sql("""
				select exists (select 1 from talent_enquiry
				               where profile_id = :profileId and sender_account_id = :sender and created_at > :since)
				""")
			.param("profileId", profileId)
			.param("sender", senderAccountId)
			.param("since", Timestamp.from(since))
			.query(Boolean.class)
			.single();
	}

	/** The messages sent through a profile, the newest first. */
	public List<Enquiry> enquiries(UUID profileId, int limit) {
		return jdbc.sql("""
				select id, sender_account_id, message, created_at from talent_enquiry
				where profile_id = ? order by created_at desc, id limit ?
				""")
			.params(profileId, limit)
			.query((row, index) -> new Enquiry(row.getObject("id", UUID.class),
					row.getObject("sender_account_id", UUID.class), row.getString("message"),
					row.getTimestamp("created_at").toInstant()))
			.list();
	}
}
