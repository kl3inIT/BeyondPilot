package ai.genaifund.beyondpilot.notification;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.notification.persistence.EmailSuppressionRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionOperations;

/**
 * Who a test email goes to: the operator who asked unless they name another address. A test to another address is an
 * email in BeyondPilot's name to someone, so it is held to the rules of any other email: never to a suppressed address,
 * only so many an hour, and recorded in the audit log before it leaves. A test to oneself is not recorded or counted.
 */
@Component
class TestRecipients {

	/** How many tests to other people one operator may send in {@link #WINDOW}. */
	static final int HOURLY_LIMIT = 10;

	private static final Duration WINDOW = Duration.ofHours(1);

	private static final String RESOURCE = "email_address";

	/**
	 * One address in only the characters every mail parser reads the same way, as for a sign-in code, so no value is
	 * one address here and several recipients, or a name and an address, to the mail library.
	 */
	private static final Pattern ADDRESS = Pattern.compile("[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+");

	private static final int MAX_ADDRESS_LENGTH = 254;

	private final EmailSuppressionRepository suppressions;

	private final AuditTrail audit;

	private final TransactionOperations transactions;

	TestRecipients(EmailSuppressionRepository suppressions, AuditTrail audit, TransactionOperations transactions) {
		this.suppressions = suppressions;
		this.audit = audit;
		this.transactions = transactions;
	}

	/**
	 * The address a test may go to. A test to anyone else is counted against the hourly limit and recorded in one
	 * transaction, before it is sent: a test that fails to leave stays recorded as asked for.
	 * @param subject what the test is of, kept with the record
	 * @throws NotificationException when {@code to} is not one plain address, is suppressed, or the operator has reached
	 * the limit
	 */
	String admit(Operator operator, @Nullable String to, String subject) {
		String recipient = to == null || to.isBlank() ? operator.email() : to.strip();
		if (recipient.length() > MAX_ADDRESS_LENGTH || !ADDRESS.matcher(recipient).matches()) {
			throw new NotificationException(NotificationErrorCode.TEST_RECIPIENT_INVALID,
					"The test recipient is not one plain email address");
		}
		if (suppressions.isSuppressed(recipient)) {
			throw new NotificationException(NotificationErrorCode.ADDRESS_SUPPRESSED,
					"The test recipient is suppressed");
		}
		if (!recipient.equalsIgnoreCase(operator.email())) {
			transactions.executeWithoutResult(status -> recordWithinLimit(operator, recipient, subject));
		}
		return recipient;
	}

	private void recordWithinLimit(Operator operator, String recipient, String subject) {
		if (audit.count(AuditAction.EMAIL_TEST_SEND, operator.accountId(), Instant.now().minus(WINDOW)) >= HOURLY_LIMIT) {
			throw new NotificationException(NotificationErrorCode.TEST_LIMIT_REACHED,
					"The operator has sent " + HOURLY_LIMIT + " tests to other people within the hour");
		}
		String address = recipient.toLowerCase(Locale.ROOT);
		audit.record(new AuditRecord(AuditAction.EMAIL_TEST_SEND,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(RESOURCE, address, recipient), Map.of("subject", subject)));
	}

}
