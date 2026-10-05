package ai.genaifund.beyondpilot.audit;

import java.util.Set;

import com.fasterxml.jackson.annotation.JsonValue;

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

	OPERATOR_WITHDRAW("operator.withdraw"),

	PROGRAM_CREATE("program.create"),

	PROGRAM_UPDATE("program.update"),

	PROGRAM_PUBLISH("program.publish"),

	PROGRAM_UNPUBLISH("program.unpublish");

	private final String value;

	private final Set<String> detailFields;

	AuditAction(String value, String... detailFields) {
		this.value = value;
		this.detailFields = Set.of(detailFields);
	}

	/** The stored name, {@code <subject>.<verb>}; the API publishes an action by it. */
	@JsonValue
	public String value() {
		return value;
	}

	/**
	 * The action a stored name stands for.
	 * @throws IllegalArgumentException when the catalog holds no such name
	 */
	public static AuditAction of(String value) {
		for (AuditAction action : values()) {
			if (action.value.equals(value)) {
				return action;
			}
		}
		throw new IllegalArgumentException("No audit action is named " + value);
	}

	Set<String> detailFields() {
		return detailFields;
	}

}
