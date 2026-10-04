package ai.genaifund.beyondpilot.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The audit record against PostgreSQL: what an event keeps, that it lives and dies with the change it describes, and
 * that the database itself refuses to alter or remove one.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AuditTrailTest {

	@Autowired
	private AuditTrail trail;

	@Autowired
	private TransactionTemplate transaction;

	@Autowired
	private JdbcClient jdbc;

	@Test
	void anEventKeepsWhoDidWhatToWhatAsTheyWereNamed() {
		UUID operator = UUID.randomUUID();
		String account = UUID.randomUUID().toString();

		transaction.executeWithoutResult(status -> trail.record(new AuditRecord(AuditAction.OPERATOR_GRANT,
				new AuditRecord.Actor(operator, "Hà Lê", "ha.le@example.test"),
				new AuditRecord.Resource("account", account, "minh.tran@example.test"), Map.of("source", "operator"))));

		Map<String, Object> event = jdbc.sql("""
				select action, actor_id, actor_label, actor_email, resource_type, resource_label,
				       details ->> 'source' as source, occurred_at
				from audit_event where resource_id = ?
				""").param(account).query().singleRow();
		assertThat(event).containsEntry("action", "operator.grant")
			.containsEntry("actor_id", operator)
			.containsEntry("actor_label", "Hà Lê")
			.containsEntry("actor_email", "ha.le@example.test")
			.containsEntry("resource_type", "account")
			.containsEntry("resource_label", "minh.tran@example.test")
			.containsEntry("source", "operator");
		assertThat(event.get("occurred_at")).isNotNull();
	}

	@Test
	void anEventOfTheServerConfigurationHasNoActor() {
		String account = UUID.randomUUID().toString();

		transaction.executeWithoutResult(status -> trail.record(new AuditRecord(AuditAction.OPERATOR_GRANT, null,
				new AuditRecord.Resource("account", account, "first@example.test"),
				Map.of("source", "configuration"))));

		Map<String, Object> event = jdbc.sql("select actor_id, actor_label from audit_event where resource_id = ?")
			.param(account)
			.query()
			.singleRow();
		assertThat(event).containsEntry("actor_id", null).containsEntry("actor_label", null);
	}

	@Test
	void aChangeThatRollsBackLeavesNoEvent() {
		String account = UUID.randomUUID().toString();

		transaction.executeWithoutResult(status -> {
			trail.record(disabling(account));
			status.setRollbackOnly();
		});

		assertThat(eventsOf(account)).isZero();
	}

	@Test
	void recordingNeedsTheTransactionOfTheChange() {
		String account = UUID.randomUUID().toString();

		assertThatThrownBy(() -> trail.record(disabling(account)))
			.isInstanceOf(IllegalTransactionStateException.class);
		assertThat(eventsOf(account)).isZero();
	}

	@Test
	void anEventCanBeNeitherChangedNorRemoved() {
		String account = UUID.randomUUID().toString();
		transaction.executeWithoutResult(status -> trail.record(disabling(account)));

		assertThatThrownBy(
				() -> jdbc.sql("update audit_event set action = 'account.enable' where resource_id = ?")
					.param(account)
					.update())
			.isInstanceOf(DataAccessException.class)
			.hasMessageContaining("append-only");
		assertThatThrownBy(() -> jdbc.sql("delete from audit_event where resource_id = ?").param(account).update())
			.isInstanceOf(DataAccessException.class)
			.hasMessageContaining("append-only");
		assertThat(eventsOf(account)).isOne();
	}

	@Test
	void anActionRefusesADetailItDidNotDeclare() {
		assertThatThrownBy(() -> new AuditRecord(AuditAction.ACCOUNT_DISABLE, null,
				new AuditRecord.Resource("account", "1", "someone@example.test"), Map.of("secret", "value")))
			.isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("account.disable");
	}

	private static AuditRecord disabling(String account) {
		return new AuditRecord(AuditAction.ACCOUNT_DISABLE,
				new AuditRecord.Actor(UUID.randomUUID(), "An operator", "operator@example.test"),
				new AuditRecord.Resource("account", account, "someone@example.test"), Map.of());
	}

	private long eventsOf(String account) {
		return jdbc.sql("select count(*) from audit_event where resource_id = ?")
			.param(account)
			.query(Long.class)
			.single();
	}

}
