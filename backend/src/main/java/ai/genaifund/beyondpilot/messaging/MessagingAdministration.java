package ai.genaifund.beyondpilot.messaging;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.messaging.MessagingChanges.Audience;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent;
import ai.genaifund.beyondpilot.messaging.dto.ProgramConversationAssignmentResponse;
import ai.genaifund.beyondpilot.messaging.dto.ReportedRequestListRequest;
import ai.genaifund.beyondpilot.messaging.dto.ReportedRequestListResponse;
import ai.genaifund.beyondpilot.messaging.dto.ReportedRequestResponse;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository.Reported;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators read of conversations in Messages: the first messages the side written to reported as unwanted.
 * A conversation that was not reported is its two sides' alone.
 */
@Service
public class MessagingAdministration {

	static final int PAGE_SIZE = 25;

	private final MessagingRepository conversations;

	private final IdentityService identity;

	private final OrganizationDirectory organizations;
	private final MessagingChanges changes;
	private final AuditTrail audit;

	MessagingAdministration(MessagingRepository conversations, IdentityService identity,
			OrganizationDirectory organizations, MessagingChanges changes, AuditTrail audit) {
		this.conversations = conversations;
		this.identity = identity;
		this.organizations = organizations;
		this.changes = changes;
		this.audit = audit;
	}

	/** The metadata of program conversations, with no sender or message content. */
	@Transactional(readOnly = true)
	public List<ProgramConversationAssignmentResponse> programAssignments(Actor actor) {
		identity.requireOperator(actor);
		return conversations.programAssignmentQueue(100).stream()
			.map(row -> new ProgramConversationAssignmentResponse(row.id(), row.subjectName(), row.createdAt(), row.assigneeId()))
			.toList();
	}

	/** Assigns one program conversation to an active operator. Only that operator can read it. */
	@Transactional
	public void assignProgram(Actor actor, UUID conversationId, UUID accountId) {
		var operator = identity.requireOperator(actor);
		var conversation = conversations.findForUpdate(conversationId)
			.filter(found -> MessagingRepository.PROGRAM.equals(found.kind()))
			.orElseThrow(() -> new MessagingException(MessagingErrorCode.CONVERSATION_NOT_FOUND,
					"Program conversation not found: " + conversationId));
		if (!identity.isOperator(new Actor(accountId))) {
			throw new MessagingException(MessagingErrorCode.OPERATOR_NOT_FOUND,
					"Assignee is not an active operator: " + accountId);
		}
		UUID previous = conversations.programAssignee(conversation.id());
		conversations.assignProgram(conversation.id(), accountId);
		audit.record(new AuditRecord(AuditAction.MESSAGING_PROGRAM_ASSIGN,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("conversation", conversationId.toString(), conversation.subjectName()),
				Map.of("account", accountId.toString())));
		if (previous != null && !previous.equals(accountId)) {
			changes.tell(new Audience(java.util.Set.of(previous)),
					listener -> new MessagingEvent(MessagingEvent.Kind.CONVERSATION, conversationId, null, null, null, null, null));
		}
		changes.tell(new Audience(java.util.Set.of(accountId)),
				listener -> new MessagingEvent(MessagingEvent.Kind.CONVERSATION, conversationId, null, null, null, null, null));
	}

	/**
	 * One page of the first messages reported as unwanted, the most recently reported first, with who sent them.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public ReportedRequestListResponse reported(Actor actor, ReportedRequestListRequest request) {
		identity.requireOperator(actor);
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		List<Reported> rows = conversations.reportedPage(size, (long) (page - 1) * size);
		Map<UUID, Person> senders = identity
			.people(rows.stream().map(row -> row.conversation().starterAccountId()).distinct().toList());
		Map<UUID, OrganizationName> senderOrganizations = organizations.names(rows.stream()
			.map(row -> row.conversation().starterOrganizationId())
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		return new ReportedRequestListResponse(rows.stream().map(row -> {
			Person sender = senders.get(row.conversation().starterAccountId());
			UUID organizationId = row.conversation().starterOrganizationId();
			OrganizationName organization = organizationId == null ? null : senderOrganizations.get(organizationId);
			return new ReportedRequestResponse(row.conversation().id(), row.conversation().kind(),
					row.conversation().subjectName(), sender == null ? null : sender.displayName(),
					sender == null ? "" : sender.email(), organization == null ? null : organization.name(),
					row.message(), row.conversation().createdAt(), row.conversation().answeredAt());
		}).toList(), page, size, conversations.reportedCount());
	}

}
