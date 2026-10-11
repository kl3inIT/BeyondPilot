package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRepository;
import ai.genaifund.beyondpilot.proposal.persistence.UseCaseProposalRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the applications and the proposals to use cases of a merged organization to the one kept; a draft proposal for
 * a use case the kept one also has a proposal for is dropped, a sent one stays with the organization that sent it. It listens inside the merge transaction, so the
 * merge fails whole when the move does.
 */
@Component
class ProposalOrganizationMerge {

	private final ProposalRepository proposals;

	private final UseCaseProposalRepository useCaseProposals;

	ProposalOrganizationMerge(ProposalRepository proposals, UseCaseProposalRepository useCaseProposals) {
		this.proposals = proposals;
		this.useCaseProposals = useCaseProposals;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		proposals.moveToOrganization(merged.organizationId(), merged.intoId());
		useCaseProposals.moveToOrganization(merged.organizationId(), merged.intoId());
		useCaseProposals.deleteDraftsOf(merged.organizationId());
	}
}
