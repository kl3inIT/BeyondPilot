package ai.genaifund.beyondpilot.matching;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.organization.OrganizationMerged;

/**
 * Gives the invitations to propose of a merged provider to the organization kept, so that the proposal the kept one
 * sends is still read as the answer to them. Where both were invited for one use case, the kept one's invitation
 * stands and the merged one's is dropped: one provider, one invitation. It listens inside the merge transaction, so
 * the merge fails whole when the move does.
 */
@Component
class MatchingOrganizationMerge {

	private final MatchingRepository matching;

	MatchingOrganizationMerge(MatchingRepository matching) {
		this.matching = matching;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		matching.moveInvitations(merged.organizationId(), merged.intoId());
	}

}
