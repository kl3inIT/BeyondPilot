package ai.genaifund.beyondpilot.notification;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Operator;
import org.jspecify.annotations.Nullable;
import org.springframework.transaction.support.TransactionOperations;

/**
 * Who a test email goes to: the operator who asked unless they name another address. A test to another address is an
 * email in BeyondPilot's name to someone, so it is recorded in the audit log; one to oneself is not.
 */
final class TestRecipients {

	private static final String RESOURCE = "email_address";

	/** One address, as a mail server takes it; the provider checks it fully. */
	private static final Pattern ADDRESS = Pattern.compile("[^\\s@]{1,64}@[^\\s@]+\\.[^\\s@]+");

	private TestRecipients() {
	}

	/**
	 * @throws NotificationException when {@code to} is not one email address
	 */
	static String recipient(Operator operator, @Nullable String to) {
		if (to == null || to.isBlank()) {
			return operator.email();
		}
		String address = to.strip();
		if (address.length() > 254 || !ADDRESS.matcher(address).matches()) {
			throw new NotificationException(NotificationErrorCode.TEST_RECIPIENT_INVALID,
					"The test recipient is not one email address");
		}
		return address;
	}

	/** Records a test to another address. A test runs outside a transaction, so the record has one of its own. */
	static void record(AuditTrail audit, TransactionOperations transactions, Operator operator, String recipient,
			String subject) {
		if (recipient.toLowerCase(Locale.ROOT).equals(operator.email().toLowerCase(Locale.ROOT))) {
			return;
		}
		transactions.executeWithoutResult(status -> audit.record(new AuditRecord(AuditAction.EMAIL_TEST_SEND,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(RESOURCE, recipient.toLowerCase(Locale.ROOT), recipient),
				Map.of("subject", subject))));
	}

}
