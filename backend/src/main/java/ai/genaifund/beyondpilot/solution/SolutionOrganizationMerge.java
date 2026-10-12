package ai.genaifund.beyondpilot.solution;

import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import ai.genaifund.beyondpilot.solution.persistence.OfferQueryRepository;
import ai.genaifund.beyondpilot.solution.persistence.SolutionQueryRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the solutions of a merged organization, and the offers it wrote for them, to the one kept. It listens inside
 * the merge transaction, so the merge fails whole when the move does.
 */
@Component
class SolutionOrganizationMerge {

	private final SolutionQueryRepository solutions;

	private final OfferQueryRepository offers;

	SolutionOrganizationMerge(SolutionQueryRepository solutions, OfferQueryRepository offers) {
		this.solutions = solutions;
		this.offers = offers;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		solutions.moveToOrganization(merged.organizationId(), merged.intoId());
		offers.moveToOrganization(merged.organizationId(), merged.intoId());
	}
}
