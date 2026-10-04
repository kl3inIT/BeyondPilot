package ai.genaifund.beyondpilot.audit;

import java.util.Set;

/**
 * What an audit event records. The values are an append-only catalog: a recorded action keeps its meaning, so an event
 * of last year reads the same as one of today. Adding an action is an ordinary change; changing or removing one is not.
 *
 * <p>
 * Each action names the fields its details may carry. A field it did not name is refused, so a slip at one call site
 * cannot put a secret into the record.
 */
public enum AuditAction {

	ACCOUNT_DISABLE("account.disable"),

	ACCOUNT_ENABLE("account.enable"),

	/** {@code source} is {@code operator} or {@code configuration}. */
	OPERATOR_GRANT("operator.grant", "source"),

	OPERATOR_WITHDRAW("operator.withdraw");

	private final String value;

	private final Set<String> detailFields;

	AuditAction(String value, String... detailFields) {
		this.value = value;
		this.detailFields = Set.of(detailFields);
	}

	/** The stored name, {@code <subject>.<verb>}. */
	public String value() {
		return value;
	}

	Set<String> detailFields() {
		return detailFields;
	}

}
