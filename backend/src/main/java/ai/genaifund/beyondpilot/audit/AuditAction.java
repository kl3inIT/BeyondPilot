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

	PROGRAM_UNPUBLISH("program.unpublish"),

	/** An operator created an organization for a company that is not here yet. */
	ORGANIZATION_CREATE("organization.create"),

	ORGANIZATION_APPROVE("organization.approve"),

	/** {@code reason} is the code of the reason given. */
	ORGANIZATION_REFUSE("organization.refuse", "reason"),

	/** An operator let a person own an organization nobody owned. {@code account} is that person's identifier. */
	ORGANIZATION_CLAIM_APPROVE("organization.claim_approve", "account"),

	ORGANIZATION_CLAIM_DECLINE("organization.claim_decline", "account"),

	/** An owner changed what a member may do. {@code account} is the member, {@code role} the new role. */
	ORGANIZATION_MEMBER_ROLE("organization.member_role", "account", "role"),

	ORGANIZATION_MEMBER_REMOVE("organization.member_remove", "account"),

	SOLUTION_APPROVE("solution.approve"),

	/** {@code reason} is the code of the reason given. */
	SOLUTION_REJECT("solution.reject", "reason"),

	/** An operator approved what an organization tells about a customer of a solution. */
	SOLUTION_DEPLOYMENT_APPROVE("solution.deployment_approve"),

	/** {@code reason} is the code of the reason given. */
	SOLUTION_DEPLOYMENT_REJECT("solution.deployment_reject", "reason"),

	/** An owner answered a request for an introduction, and both sides were told each other's address. */
	INTRODUCTION_REPLY("introduction.reply"),

	INTRODUCTION_DECLINE("introduction.decline"),

	TALENT_APPROVE("talent.approve"),

	/** Recorded before asking for changes and removing were two decisions. {@code reason} is the code given. */
	TALENT_REJECT("talent.reject", "reason"),

	/** The person behind a profile accepted a message, and both sides were told each other's address. */
	TALENT_ENQUIRY_ACCEPT("talent.enquiry_accept"),

	TALENT_ENQUIRY_DECLINE("talent.enquiry_decline"),

	/** The person reported a message as unwanted; the sender was told it was declined. */
	TALENT_ENQUIRY_REPORT("talent.enquiry_report"),

	/** {@code reason} is the code of the reason given. */
	TALENT_REQUEST_CHANGES("talent.request_changes", "reason"),

	/** An operator took an approved profile away from the public. {@code reason} is the code of the reason given. */
	TALENT_REMOVE("talent.remove", "reason"),

	/** The person deleted their own profile. */
	TALENT_DELETE("talent.delete");

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
