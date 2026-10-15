package ai.genaifund.beyondpilot.notification.template;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * What an email is for. The values are stored with every message and with every operator's wording, so a value keeps
 * its meaning; adding a kind is an ordinary change. A kind that is no longer sent leaves this catalog, and the log
 * keeps the messages of it under the value they were stored with.
 *
 * <p>
 * Each kind declares the variables its templates may use. A template that names any other is refused, and one that
 * leaves out a required variable is refused, so an operator's edit can neither leak a value nor drop the one the email
 * exists for.
 */
public enum EmailKind {

	SIGN_IN_CODE("sign_in_code", EmailGroup.SIGN_IN, true, null,
			Variable.required("code", "482913"), Variable.required("minutes", "15")),

	ORGANIZATION_INVITATION("organization_invitation", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover"), Variable.required("inviterName", "Hà Lê"),
			Variable.optional("owner", Boolean.FALSE),
			Variable.optional("organizationUrl", "https://beyondpilot.example/workspace/organization")),

	ORGANIZATION_APPROVED("organization_approved", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover"),
			Variable.optional("organizationUrl", "https://beyondpilot.example/organizations/plain-cover")),

	ORGANIZATION_REFUSED("organization_refused", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover")),

	ORGANIZATION_SENT_BACK("organization_sent_back", EmailGroup.ORGANIZATIONS, true, "reason",
			Variable.required("organizationName", "Plain Cover"),
			Variable.quote("reason", "Add the website of the company."),
			Variable.optional("organizationUrl", "https://beyondpilot.example/workspace/organization")),

	ORGANIZATION_REQUEST_APPROVED("organization_request_approved", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover"), Variable.optional("claim", Boolean.FALSE),
			Variable.optional("organizationUrl", "https://beyondpilot.example/workspace/organization")),

	ORGANIZATION_REQUEST_DECLINED("organization_request_declined", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover"), Variable.optional("claim", Boolean.FALSE)),

	ORGANIZATION_TAKEN_DOWN("organization_taken_down", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover")),

	ORGANIZATION_RESTORED("organization_restored", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover"),
			Variable.optional("organizationUrl", "https://beyondpilot.example/organizations/plain-cover")),

	ORGANIZATION_MERGED("organization_merged", EmailGroup.ORGANIZATIONS, true, null,
			Variable.required("organizationName", "Plain Cover Ltd"), Variable.required("keptName", "Plain Cover")),

	APPLICATION_RECEIVED("application_received", EmailGroup.APPLICATIONS, true, null,
			Variable.required("programName", "AI for Insurance Challenge × Tasco"),
			Variable.optional("resubmitted", Boolean.FALSE),
			Variable.optional("editableUntil", "15 Oct 2026, 23:59 ICT"),
			Variable.optional("applicationUrl", "https://beyondpilot.example/applications/1")),

	REVIEWER_INVITATION("reviewer_invitation", EmailGroup.APPLICATIONS, true, null,
			Variable.required("programName", "AI for Insurance Challenge × Tasco"),
			Variable.required("inviterName", "Hà Lê"), Variable.required("expiresOn", "20 Oct 2026"),
			Variable.optional("reviewsUrl", "https://beyondpilot.example/reviews/1")),

	/** The subject and the message are what an operator wrote for one release of outcomes; nobody edits a template. */
	APPLICATION_OUTCOME("application_outcome", EmailGroup.APPLICATIONS, false, null,
			Variable.required("subject", "Shortlisted: AI for Insurance Challenge × Tasco"),
			Variable.required("message", "Hi Minh,\n\nYour team is on the shortlist."),
			Variable.optional("applicationUrl", "https://beyondpilot.example/applications/1")),

	SOLUTION_APPROVED("solution_approved", EmailGroup.SOLUTIONS, true, null,
			Variable.required("solutionName", "ClaimLens"), Variable.required("organizationName", "Plain Cover"),
			Variable.optional("solutionUrl", "https://beyondpilot.example/solutions/claimlens")),

	SOLUTION_SENT_BACK("solution_sent_back", EmailGroup.SOLUTIONS, true, "reason",
			Variable.required("solutionName", "ClaimLens"), Variable.required("organizationName", "Plain Cover"),
			Variable.quote("reason", "Name a customer who uses it."),
			Variable.optional("solutionUrl", "https://beyondpilot.example/workspace/organization/solutions/1")),

	SOLUTION_REJECTED("solution_rejected", EmailGroup.SOLUTIONS, true, null,
			Variable.required("solutionName", "ClaimLens"), Variable.required("organizationName", "Plain Cover")),

	SOLUTION_TAKEN_DOWN("solution_taken_down", EmailGroup.SOLUTIONS, true, null,
			Variable.required("solutionName", "ClaimLens"), Variable.required("organizationName", "Plain Cover")),

	SOLUTION_RESTORED("solution_restored", EmailGroup.SOLUTIONS, true, null,
			Variable.required("solutionName", "ClaimLens"), Variable.required("organizationName", "Plain Cover"),
			Variable.optional("solutionUrl", "https://beyondpilot.example/solutions/claimlens")),

	USE_CASE_APPROVED("use_case_approved", EmailGroup.USE_CASES, true, null,
			Variable.required("useCaseTitle", "Claims triage for motor insurance"),
			Variable.required("organizationName", "Plain Cover"),
			Variable.optional("useCaseUrl", "https://beyondpilot.example/use-cases/1")),

	USE_CASE_SENT_BACK("use_case_sent_back", EmailGroup.USE_CASES, true, "reason",
			Variable.required("useCaseTitle", "Claims triage for motor insurance"),
			Variable.required("organizationName", "Plain Cover"),
			Variable.quote("reason", "Say which lines of business it covers."),
			Variable.optional("useCaseUrl", "https://beyondpilot.example/workspace/organization/use-cases/1")),

	PROPOSAL_SENT("proposal_sent", EmailGroup.USE_CASES, true, null,
			Variable.required("useCaseTitle", "Claims triage for motor insurance"),
			Variable.required("organizationName", "Plain Cover"),
			Variable.required("proposalUrl", "https://beyondpilot.example/use-cases/1/propose/view"),
			Variable.optional("editableUntil", "19 Oct 2026, 23:59 ICT")),

	PROPOSAL_SHORTLISTED("proposal_shortlisted", EmailGroup.USE_CASES, true, "message",
			Variable.optional("recipientName", "Minh Trần"),
			Variable.required("useCaseTitle", "Claims triage for motor insurance"),
			Variable.optional("organizationName", "Pocket Policy"),
			Variable.optional("proposalUrl", "https://beyondpilot.example/use-cases/1/propose/view"),
			Variable.quote("message", "We would like to talk next week.")),

	PROPOSAL_DECLINED("proposal_declined", EmailGroup.USE_CASES, true, "message",
			Variable.optional("recipientName", "Minh Trần"),
			Variable.required("useCaseTitle", "Claims triage for motor insurance"),
			Variable.optional("organizationName", "Pocket Policy"),
			Variable.optional("proposalUrl", "https://beyondpilot.example/use-cases/1/propose/view"),
			Variable.quote("message", null)),

	MATCHING_INVITATION("matching_invitation", EmailGroup.USE_CASES, true, "note",
			Variable.required("inviterName", "Tasco Insurance"), Variable.required("providerName", "Papaya"),
			Variable.required("solutionName", "Papaya Claims"),
			Variable.required("useCaseTitle", "Claims triage for motor insurance"),
			Variable.optional("closesAt", "15 Oct 2026, 23:59 ICT"),
			Variable.optional("useCaseUrl", "https://beyondpilot.example/use-cases/1"),
			Variable.quote("note", "We would like to hear how you handle renewals.")),

	TALENT_APPROVED("talent_approved", EmailGroup.TALENT, true, "note",
			Variable.required("profileName", "Mei Tan"), Variable.quote("note", null),
			Variable.optional("profileUrl", "https://beyondpilot.example/talent/mei-tan")),

	TALENT_CHANGES_REQUESTED("talent_changes_requested", EmailGroup.TALENT, true, "note",
			Variable.required("profileName", "Mei Tan"), Variable.quote("note", "Say what you built."),
			Variable.optional("profileUrl", "https://beyondpilot.example/workspace/talent")),

	TALENT_REMOVED("talent_removed", EmailGroup.TALENT, true, "note",
			Variable.required("profileName", "Mei Tan"), Variable.quote("note", null)),

	TALENT_RESTORED("talent_restored", EmailGroup.TALENT, true, null, Variable.required("profileName", "Mei Tan"),
			Variable.optional("profileUrl", "https://beyondpilot.example/talent/mei-tan")),

	MESSAGE_REQUEST("message_request", EmailGroup.MESSAGES, true, null,
			Variable.optional("senderName", "Minh Trần"), Variable.optional("senderOrganization", "Pocket Policy"),
			Variable.required("about", "ClaimLens"),
			Variable.optional("messagesUrl", "https://beyondpilot.example/workspace/messages")),

	MESSAGE_REQUEST_REMINDER("message_request_reminder", EmailGroup.MESSAGES, true, null,
			Variable.optional("senderName", "Minh Trần"), Variable.required("daysLeft", "7"),
			Variable.optional("messagesUrl", "https://beyondpilot.example/workspace/messages")),

	MESSAGE_REQUEST_ACCEPTED("message_request_accepted", EmailGroup.MESSAGES, true, null,
			Variable.optional("otherName", "Plain Cover"),
			Variable.optional("messagesUrl", "https://beyondpilot.example/workspace/messages")),

	MESSAGE_REQUEST_DECLINED("message_request_declined", EmailGroup.MESSAGES, true, null,
			Variable.optional("otherName", "Plain Cover"),
			Variable.optional("messagesUrl", "https://beyondpilot.example/workspace/messages")),

	MESSAGE_REQUEST_CLOSED("message_request_closed", EmailGroup.MESSAGES, true, null,
			Variable.optional("otherName", "Plain Cover"),
			Variable.optional("messagesUrl", "https://beyondpilot.example/workspace/messages")),

	MESSAGE_UNREAD("message_unread", EmailGroup.MESSAGES, true, null, Variable.optional("senderName", "Mei Tan"),
			Variable.optional("messagesUrl", "https://beyondpilot.example/workspace/messages"));

	private final String value;

	private final EmailGroup group;

	private final boolean editable;

	private final @Nullable String quote;

	private final List<Variable> variables;

	EmailKind(String value, EmailGroup group, boolean editable, @Nullable String quote, Variable... variables) {
		this.value = value;
		this.group = group;
		this.editable = editable;
		this.quote = quote;
		this.variables = List.of(variables);
	}

	public String value() {
		return value;
	}

	public EmailGroup group() {
		return group;
	}

	/**
	 * The variable the layout quotes after the text, as it was written; null when the kind quotes nothing. Templates
	 * do not use it.
	 */
	public @Nullable String quote() {
		return quote;
	}

	public List<Variable> variables() {
		return variables;
	}

	/** Whether operators edit its wording; an email written in full by an operator each time has nothing to edit. */
	public boolean editable() {
		return editable;
	}

	public static Optional<EmailKind> of(String value) {
		return Arrays.stream(values()).filter(kind -> kind.value.equals(value)).findFirst();
	}

	/**
	 * A value a template may use.
	 * @param sample what the preview shows in its place; null for a quote that is often absent
	 * @param required whether every template of the kind must use it
	 * @param quoted whether the layout quotes it instead of the templates
	 */
	public record Variable(String name, @Nullable Object sample, boolean required, boolean quoted) {

		static Variable required(String name, Object sample) {
			return new Variable(name, sample, true, false);
		}

		static Variable optional(String name, Object sample) {
			return new Variable(name, sample, false, false);
		}

		static Variable quote(String name, @Nullable Object sample) {
			return new Variable(name, sample, false, true);
		}

		/**
		 * Whether it only shows or hides a passage, never printed: a variable whose sample is true or false, as
		 * {@code owner} of an invitation is.
		 */
		public boolean isSwitch() {
			return sample instanceof Boolean;
		}

	}

}
