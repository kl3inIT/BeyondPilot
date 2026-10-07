package ai.genaifund.beyondpilot.introduction;

import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import ai.genaifund.beyondpilot.introduction.persistence.IntroductionRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the introduction requests to and from a merged organization to the one kept. It listens inside the merge
 * transaction, so the merge fails whole when the move does.
 */
@Component
class IntroductionOrganizationMerge {

	private final IntroductionRepository requests;

	IntroductionOrganizationMerge(IntroductionRepository requests) {
		this.requests = requests;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		requests.moveToOrganization(merged.organizationId(), merged.intoId());
	}
}
