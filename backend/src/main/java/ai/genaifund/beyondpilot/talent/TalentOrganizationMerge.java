package ai.genaifund.beyondpilot.talent;

import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the talent enquiries sent for a merged organization to the one kept. It listens inside the merge
 * transaction, so the merge fails whole when the move does.
 */
@Component
class TalentOrganizationMerge {

	private final TalentDetailRepository enquiries;

	TalentOrganizationMerge(TalentDetailRepository enquiries) {
		this.enquiries = enquiries;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		enquiries.moveToOrganization(merged.organizationId(), merged.intoId());
	}
}
