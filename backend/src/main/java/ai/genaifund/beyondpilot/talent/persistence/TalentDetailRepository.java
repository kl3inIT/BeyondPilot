package ai.genaifund.beyondpilot.talent.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * What hangs on a profile: the projects it shows and the messages sent through it, with their answers. The rows are small and change by
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

	/** The states of an enquiry. Only {@code accepted} has shared the two addresses. */
	public static final String PENDING = "pending";

	public static final String ACCEPTED = "accepted";

	public static final String DECLINED = "declined";

	public static final String REPORTED = "reported";

	public static final String CLOSED = "closed";

	private static final String SELECT_ENQUIRY = """
			select id, profile_id, sender_account_id, sender_organization_id, topic, message, status, created_at,
			       answered_at
			from talent_enquiry
			""";

	/**
	 * One message sent through a profile, with what became of it.
	 * @param senderOrganizationId the organization the sender belonged to when they wrote; null when none
	 * @param answeredAt when the person answered it or it closed; null while it waits
	 */
	public record Enquiry(UUID id, UUID profileId, UUID senderAccountId, @Nullable UUID senderOrganizationId,
			String topic, String message, String status, Instant createdAt, @Nullable Instant answeredAt) {
	}

	/** A message its person reported, with the profile it was sent through. */
	public record ReportedEnquiry(UUID id, UUID profileId, String profileName, UUID senderAccountId, String topic,
			String message, Instant createdAt, @Nullable Instant answeredAt) {
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

	/**
	 * Records a message that waits for the person's answer.
	 * @return false when the sender already has one waiting for this profile
	 */
	public boolean addEnquiry(UUID profileId, UUID senderAccountId, @Nullable UUID senderOrganizationId, String topic,
			String message) {
		return jdbc.sql("""
				insert into talent_enquiry (id, profile_id, sender_account_id, sender_organization_id, topic, message)
				values (:id, :profileId, :sender, :organization, :topic, :message)
				on conflict (sender_account_id, profile_id) where status = 'pending' do nothing
				""")
			.param("id", UUID.randomUUID())
			.param("profileId", profileId)
			.param("sender", senderAccountId)
			.param("organization", senderOrganizationId, Types.OTHER)
			.param("topic", topic)
			.param("message", message)
			.update() == 1;
	}

	/** When this sender's waiting message to this profile was sent; empty when none waits. */
	public Optional<Instant> waitingSince(UUID profileId, UUID senderAccountId) {
		return jdbc.sql("""
				select created_at from talent_enquiry
				where profile_id = ? and sender_account_id = ? and status = 'pending'
				""")
			.params(profileId, senderAccountId)
			.query((row, index) -> row.getTimestamp("created_at").toInstant())
			.optional();
	}

	/** How many messages this sender started after the moment given, to any profile. */
	public int sentSince(UUID senderAccountId, Instant since) {
		return jdbc.sql("select count(*) from talent_enquiry where sender_account_id = ? and created_at > ?")
			.params(senderAccountId, Timestamp.from(since))
			.query(Integer.class)
			.single();
	}

	/** The messages sent through a profile, those that wait first, then the newest. */
	public List<Enquiry> enquiries(UUID profileId, int limit) {
		return jdbc.sql(SELECT_ENQUIRY + """
				where profile_id = ? order by (status = 'pending') desc, created_at desc, id limit ?
				""").params(profileId, limit).query(TalentDetailRepository::enquiry).list();
	}

	/** One message, locked until the transaction ends, so two answers to it cannot both pass. */
	public Optional<Enquiry> findEnquiryForUpdate(UUID id) {
		return jdbc.sql(SELECT_ENQUIRY + "where id = ? for update").param(id).query(TalentDetailRepository::enquiry).optional();
	}

	/** Records the end of a waiting message: the person's answer, or its close. */
	public void answer(UUID id, String status) {
		jdbc.sql("update talent_enquiry set status = ?, answered_at = now() where id = ?").params(status, id).update();
	}

	/**
	 * Waiting messages sent before the moment given, the oldest first, locked and skipped by another clock that holds
	 * them.
	 */
	public List<Enquiry> waitingBefore(Instant before, int limit) {
		return jdbc.sql(SELECT_ENQUIRY + """
				where status = 'pending' and created_at < ? order by created_at, id limit ? for update skip locked
				""").params(Timestamp.from(before), limit).query(TalentDetailRepository::enquiry).list();
	}

	/** Waiting messages sent before the moment given whose person was not reminded yet, locked as above. */
	public List<Enquiry> unremindedBefore(Instant before, int limit) {
		return jdbc.sql(SELECT_ENQUIRY + """
				where status = 'pending' and reminded_at is null and created_at < ?
				order by created_at, id limit ? for update skip locked
				""").params(Timestamp.from(before), limit).query(TalentDetailRepository::enquiry).list();
	}

	/** The reported messages, the most recently reported first. */
	public List<ReportedEnquiry> reported(int limit, long offset) {
		return jdbc.sql("""
				select e.id, e.profile_id, p.name, e.sender_account_id, e.topic, e.message, e.created_at, e.answered_at
				from talent_enquiry e join talent_profile p on p.id = e.profile_id
				where e.status = 'reported' order by e.answered_at desc nulls last, e.id limit ? offset ?
				""").params(limit, offset).query((row, index) -> {
			Timestamp answeredAt = row.getTimestamp("answered_at");
			return new ReportedEnquiry(row.getObject("id", UUID.class), row.getObject("profile_id", UUID.class),
					row.getString("name"), row.getObject("sender_account_id", UUID.class), row.getString("topic"),
					row.getString("message"), row.getTimestamp("created_at").toInstant(),
					answeredAt == null ? null : answeredAt.toInstant());
		}).list();
	}

	public long reportedCount() {
		return jdbc.sql("select count(*) from talent_enquiry where status = 'reported'").query(Long.class).single();
	}

	public void markReminded(UUID id) {
		jdbc.sql("update talent_enquiry set reminded_at = now() where id = ?").param(id).update();
	}

	private static Enquiry enquiry(ResultSet row, int index) throws SQLException {
		Timestamp answeredAt = row.getTimestamp("answered_at");
		return new Enquiry(row.getObject("id", UUID.class), row.getObject("profile_id", UUID.class),
				row.getObject("sender_account_id", UUID.class), row.getObject("sender_organization_id", UUID.class),
				row.getString("topic"), row.getString("message"), row.getString("status"),
				row.getTimestamp("created_at").toInstant(), answeredAt == null ? null : answeredAt.toInstant());
	}
}
