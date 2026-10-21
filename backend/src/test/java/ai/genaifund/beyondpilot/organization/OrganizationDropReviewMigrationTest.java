package ai.genaifund.beyondpilot.organization;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * What {@code V109__organization_drop_review.sql} does to the organizations that exist when it runs: the database is
 * migrated to V108, filled with organizations in every state of the old review, and migrated on.
 */
@Testcontainers
class OrganizationDropReviewMigrationTest {

	private static final String BEFORE = "108";

	@Container
	private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(
			DockerImageName.parse("pgvector/pgvector:0.8.7-pg18-trixie").asCompatibleSubstituteFor("postgres"));

	@Test
	void organizationsWaitingBecomeActiveAndMarkedAndRefusedOnesBecomeTakenDown() {
		DriverManagerDataSource dataSource = new DriverManagerDataSource(POSTGRES.getJdbcUrl(),
				POSTGRES.getUsername(), POSTGRES.getPassword());
		Flyway.configure().dataSource(dataSource).target(BEFORE).load().migrate();
		JdbcClient jdbc = JdbcClient.create(dataSource);
		UUID creator = UUID.randomUUID();
		jdbc.sql("insert into identity_account (id, email) values (?, 'creator@migration.test')").param(creator).update();
		insert(jdbc, creator, "waiting", "in_review", null);
		insert(jdbc, creator, "sent-back", "needs_changes", null);
		insert(jdbc, creator, "approved", "approved", null);
		insert(jdbc, creator, "refused-fake", "rejected", "not_a_real_organization");
		insert(jdbc, creator, "refused-duplicate", "rejected", "duplicate");
		insert(jdbc, creator, "refused-scope", "rejected", "out_of_scope");

		Flyway.configure().dataSource(dataSource).load().migrate();

		assertThat(status(jdbc, "waiting")).isEqualTo("approved|true|false");
		assertThat(status(jdbc, "sent-back")).isEqualTo("approved|true|false");
		assertThat(status(jdbc, "approved")).isEqualTo("approved|false|false");
		assertThat(taken(jdbc, "refused-fake")).isEqualTo("approved|false|true|not_a_real_organization|not_a_real_organization");
		assertThat(taken(jdbc, "refused-duplicate")).isEqualTo("approved|false|true|other|duplicate");
		assertThat(taken(jdbc, "refused-scope")).isEqualTo("approved|false|true|other|out_of_scope");
	}

	private static void insert(JdbcClient jdbc, UUID creator, String slug, String status, String decisionReason) {
		jdbc.sql("""
				insert into organization (id, slug, name, type, status, decision_reason, decision_message, decided_at,
				                          created_by_account_id)
				values (?, ?, ?, 'company', ?, ?, 'A note.', now(), ?)
				""").params(UUID.randomUUID(), slug, slug, status, decisionReason, creator).update();
	}

	/** Status, whether the activation notice is pending, and whether it is taken down. */
	private static String status(JdbcClient jdbc, String slug) {
		return jdbc.sql("""
				select status || '|' || activation_notice_pending || '|' || (suspended_at is not null)
				from organization where slug = ?
				""").param(slug).query(String.class).single();
	}

	/** Status, notice, taken down, the reason it was taken down and the reason it was refused, which stays. */
	private static String taken(JdbcClient jdbc, String slug) {
		return jdbc.sql("""
				select status || '|' || activation_notice_pending || '|' || (suspended_at is not null) || '|'
				       || suspension_reason || '|' || decision_reason
				from organization where slug = ?
				""").param(slug).query(String.class).single();
	}

}
