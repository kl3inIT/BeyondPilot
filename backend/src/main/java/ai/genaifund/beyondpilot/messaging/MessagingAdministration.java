package ai.genaifund.beyondpilot.messaging;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.messaging.MessagingChanges.Audience;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent;
import ai.genaifund.beyondpilot.messaging.dto.ProgramConversationAssignmentResponse;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assigns program conversations without granting general access to message content.
 */
@Service
public class MessagingAdministration {

	private final MessagingRepository conversations;

	private final IdentityService identity;

	private final MessagingChanges changes;
	private final AuditTrail audit;

	MessagingAdministration(MessagingRepository conversations, IdentityService identity,
			MessagingChanges changes, AuditTrail audit) {
		this.conversations = conversations;
		this.identity = identity;
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
}
