package ai.genaifund.beyondpilot.usecase;

import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseQueryRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the use cases of a merged organization to the one kept. It listens inside the merge transaction, so the
 * merge fails whole when the move does.
 */
@Component
class UseCaseOrganizationMerge {

	private final UseCaseQueryRepository useCases;

	UseCaseOrganizationMerge(UseCaseQueryRepository useCases) {
		this.useCases = useCases;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		useCases.moveToOrganization(merged.organizationId(), merged.intoId());
	}
}
