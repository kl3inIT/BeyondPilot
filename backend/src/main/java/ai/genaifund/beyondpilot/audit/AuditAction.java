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

	/** An operator took an approved organization down. {@code reason} is the code of the reason given. */
	ORGANIZATION_SUSPEND("organization.suspend", "reason"),

	ORGANIZATION_RESTORE("organization.restore"),

	/** An operator changed an organization's profile or its verified domain. */
	ORGANIZATION_UPDATE("organization.update"),

	/** An operator invited an address to an organization. {@code role} is the role offered. */
	ORGANIZATION_INVITE("organization.invite", "role"),

	/** An operator took back an open invitation of an organization. */
	ORGANIZATION_INVITATION_REVOKE("organization.invitation_revoke"),

	/** {@code reason} is the code of the reason given. */
	ORGANIZATION_REFUSE("organization.refuse", "reason"),

	/** An operator sent an organization back to its owners with what to change. */
	ORGANIZATION_SEND_BACK("organization.send_back"),

	/** An operator let a person own an organization nobody owned. {@code account} is that person's identifier. */
	ORGANIZATION_CLAIM_APPROVE("organization.claim_approve", "account"),

	ORGANIZATION_CLAIM_DECLINE("organization.claim_decline", "account"),

	/** An owner changed what a member may do. {@code account} is the member, {@code role} the new role. */
	ORGANIZATION_MEMBER_ROLE("organization.member_role", "account", "role"),

	ORGANIZATION_MEMBER_REMOVE("organization.member_remove", "account"),

	SOLUTION_APPROVE("solution.approve"),

	/** An operator sent a solution back to its owners with what to change. */
	SOLUTION_SEND_BACK("solution.send_back"),

	/**
	 * An operator refused a solution for good. {@code reason} is the code of the reason given. Before BEY-76 it also
	 * recorded taking an approved solution out of the directory.
	 */
	SOLUTION_REJECT("solution.reject", "reason"),

	/** An operator took an approved solution down. {@code reason} is the code of the reason given. */
	SOLUTION_TAKE_DOWN("solution.take_down", "reason"),

	/** An operator put a solution that was taken down back. */
	SOLUTION_RESTORE("solution.restore"),

	/** An operator wrote what GenAI Fund says of a solution: who backs its company, its programme, its funding. */
	SOLUTION_BACK("solution.back"),

	/** An operator approved what an organization tells about a customer of a solution. */
	SOLUTION_DEPLOYMENT_APPROVE("solution.deployment_approve"),

	/** {@code reason} is the code of the reason given. */
	SOLUTION_DEPLOYMENT_REJECT("solution.deployment_reject", "reason"),

	/**
	 * Empty parts of a solution and its organization were filled from public sources: its deck, its website or a web
	 * search. {@code fields} names the parts filled; {@code evidence} is a JSON object giving, for each, the verbatim
	 * quote and the source it was found in. Recorded by the one-off enrichment of the old platform's records.
	 */
	SOLUTION_ENRICH("solution.enrich", "fields", "evidence"),

	/**
	 * An operator created a use case for an organization. {@code organization} is that organization's identifier,
	 * {@code status} is {@code draft} or {@code published}.
	 */
	USE_CASE_CREATE("use_case.create", "organization", "status"),

	USE_CASE_SUBMIT("use_case.submit", "organization"),

	USE_CASE_DRAFT("use_case.draft", "organization", "from"),

	USE_CASE_APPROVE("use_case.approve", "organization"),

	USE_CASE_SEND_BACK("use_case.send_back", "organization"),

	/** An operator set the programs a use case belongs to. */
	USE_CASE_SET_PROGRAMS("use_case.set_programs", "organization"),

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

	/** An operator sent a profile back to its person. {@code reason} is the code of the reason given. */
	TALENT_REQUEST_CHANGES("talent.request_changes", "reason"),

	/** {@code reason} is the code of the reason given. Its value is from when taking down was called removing. */
	TALENT_REMOVE("talent.remove", "reason"),

	/** An operator put a profile that was taken down back in the public. */
	TALENT_RESTORE("talent.restore"),

	/** The person deleted their own profile. */
	TALENT_DELETE("talent.delete"),

	/** An operator replaced the criteria a program's applications are judged on. {@code count} is how many. */
	PROPOSAL_CRITERIA_UPDATE("proposal.criteria_update", "count"),

	/** An operator invited an address to judge a program, or sent the invitation again. */
	PROPOSAL_REVIEWER_INVITE("proposal.reviewer_invite", "email"),

	PROPOSAL_REVIEWER_REMOVE("proposal.reviewer_remove", "email"),

	/** An operator decided on an application. {@code decision} is {@code shortlisted} or {@code not_selected}. */
	PROPOSAL_DECIDE("proposal.decide", "decision"),

	/** An operator released a program's outcomes. The counts are how many applicants each group had. */
	PROPOSAL_RELEASE("proposal.release", "shortlisted", "not_selected"),

	/** An operator changed who delivers email or as whom. {@code provider} is the provider chosen. */
	EMAIL_SETTINGS_UPDATE("email.settings_update", "provider"),

	/** An operator changed the accent colour or the footer note of every email. */
	EMAIL_APPEARANCE_UPDATE("email.appearance_update"),

	/** An operator changed the wording of one kind of email; the resource is the kind. */
	EMAIL_TEMPLATE_UPDATE("email.template_update"),

	/** An operator put one kind of email back to its default wording. */
	EMAIL_TEMPLATE_RESET("email.template_reset"),

	/** An operator stopped email to an address. */
	EMAIL_SUPPRESSION_ADD("email.suppression_add"),

	/** An operator let email reach an address again. {@code reason} is why it had been suppressed. */
	EMAIL_SUPPRESSION_REMOVE("email.suppression_remove", "reason"),

	/** An operator sent an email again; the resource is the message sent again. */
	EMAIL_RESEND("email.resend"),

	/**
	 * An operator sent a test email to an address not their own; the resource is that address. {@code subject} is
	 * {@code settings} or the kind of email whose draft was sent.
	 */
	EMAIL_TEST_SEND("email.test_send", "subject"),

	/** An operator connected an AI provider. {@code vendor} is {@code openai} or {@code openrouter}. */
	AI_PROVIDER_CREATE("ai.provider_create", "vendor"),

	/** An operator changed an AI provider. {@code key} is {@code kept}, {@code replaced} or {@code removed}. */
	AI_PROVIDER_UPDATE("ai.provider_update", "vendor", "key"),

	AI_PROVIDER_DELETE("ai.provider_delete"),

	/** An operator chose the provider and model search embeds with. {@code model} is the model. */
	SEARCH_MODEL_CHANGE("search.model_change", "model"),

	SEARCH_SEMANTIC_ENABLE("search.semantic_enable"),

	/** An operator turned semantic search off: search matches keywords only and calls no provider. */
	SEARCH_SEMANTIC_DISABLE("search.semantic_disable"),

	/** An operator rebuilt the search index from the published items. */
	SEARCH_INDEX_REBUILD("search.index_rebuild"),

	/** An operator let held-back items be embedded again at once. {@code count} is how many. */
	SEARCH_EMBEDDING_RETRY("search.embedding_retry", "count"),

	/** A person, or an operator for them, ended an AI app's connection to the MCP servers. */
	MCP_APP_REVOKE("mcp.app_revoke");

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
