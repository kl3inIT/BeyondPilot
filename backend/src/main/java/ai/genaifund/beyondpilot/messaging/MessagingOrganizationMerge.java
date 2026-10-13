package ai.genaifund.beyondpilot.messaging;

import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository;
import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the conversations to and from a merged organization to the one kept. It listens inside the merge transaction,
 * so the merge fails whole when the move does.
 */
@Component
class MessagingOrganizationMerge {

	private final MessagingRepository conversations;

	MessagingOrganizationMerge(MessagingRepository conversations) {
		this.conversations = conversations;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		conversations.moveToOrganization(merged.organizationId(), merged.intoId());
	}

}
