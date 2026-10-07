package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the applications of a merged organization to the one kept. It listens inside the merge transaction, so the
 * merge fails whole when the move does.
 */
@Component
class ProposalOrganizationMerge {

	private final ProposalRepository proposals;

	ProposalOrganizationMerge(ProposalRepository proposals) {
		this.proposals = proposals;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		proposals.moveToOrganization(merged.organizationId(), merged.intoId());
	}
}
