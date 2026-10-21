package ai.genaifund.beyondpilot.organization;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * What {@code V109__organization_drop_review.sql} and {@code V110__organization_active_status.sql} do to the
 * organizations that exist when they run: the database is migrated to V108, filled with organizations in every state of
 * the old review and with one really taken down, and migrated on. Together they leave every organization active, and
 * taken down only where an operator took it down.
 */
@Testcontainers
class OrganizationDropReviewMigrationTest {

	private static final String BEFORE = "108";

	@Container
	private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(
			TestcontainersConfiguration.POSTGRES_IMAGE);

	@Test
	void everyOrganizationEndsActiveAndOnlyARealTakeDownStaysDown() {
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
		insertTakenDown(jdbc, creator, "taken-down");

		Flyway.configure().dataSource(dataSource).load().migrate();

		assertThat(state(jdbc, "waiting")).isEqualTo("active|false");
		assertThat(state(jdbc, "sent-back")).isEqualTo("active|false");
		assertThat(state(jdbc, "approved")).isEqualTo("active|false");
		// A refused organization is active like the others, with nothing left of a take-down; the refusal stays recorded.
		for (String slug : new String[] { "refused-fake", "refused-duplicate", "refused-scope" }) {
			assertThat(state(jdbc, slug)).as(slug).isEqualTo("active|false");
			assertThat(jdbc.sql("""
					select suspension_reason is null and suspension_message is null
					from organization where slug = ?
					""").param(slug).query(Boolean.class).single()).as(slug).isTrue();
		}
		assertThat(jdbc.sql("select decision_reason from organization where slug = 'refused-fake'")
			.query(String.class)
			.single()).isEqualTo("not_a_real_organization");
		// What an operator took down stays down, with its reason and message.
		assertThat(state(jdbc, "taken-down")).isEqualTo("active|true");
		assertThat(jdbc.sql("select suspension_reason || '|' || suspension_message from organization where slug = 'taken-down'")
			.query(String.class)
			.single()).isEqualTo("breaks_the_rules|Taken down by an operator.");
		assertThat(jdbc.sql("select count(*) from information_schema.columns where table_name = 'organization' and column_name = 'activation_notice_pending'")
			.query(Long.class)
			.single()).isZero();
	}

	private static void insert(JdbcClient jdbc, UUID creator, String slug, String status, String decisionReason) {
		jdbc.sql("""
				insert into organization (id, slug, name, type, status, decision_reason, decision_message, decided_at,
				                          created_by_account_id)
				values (?, ?, ?, 'company', ?, ?, 'A note.', timestamptz '2026-10-01 10:00:00+00', ?)
				""").params(UUID.randomUUID(), slug, slug, status, decisionReason, creator).update();
	}

	/** An approved organization an operator took down later: approving cleared the decision, so it carries none. */
	private static void insertTakenDown(JdbcClient jdbc, UUID creator, String slug) {
		jdbc.sql("""
				insert into organization (id, slug, name, type, status, suspension_reason, suspension_message,
				                          suspended_at, created_by_account_id)
				values (?, ?, ?, 'company', 'approved', 'breaks_the_rules', 'Taken down by an operator.',
				        timestamptz '2026-10-01 10:00:00+00', ?)
				""").params(UUID.randomUUID(), slug, slug, creator).update();
	}

	/** Status and whether it is taken down. */
	private static String state(JdbcClient jdbc, String slug) {
		return jdbc.sql("select status || '|' || (suspended_at is not null) from organization where slug = ?")
			.param(slug)
			.query(String.class)
			.single();
	}

}
