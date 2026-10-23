package ai.genaifund.beyondpilot.perk;

import ai.genaifund.beyondpilot.organization.OrganizationMerged;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaimRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Gives the perks of a merged organization, and the claims made for it, to the one kept. It listens inside the merge
 * transaction, so the merge fails whole when the move does.
 */
@Component
class PerkOrganizationMerge {

	private final PerkRepository perks;

	private final PerkClaimRepository claims;

	PerkOrganizationMerge(PerkRepository perks, PerkClaimRepository claims) {
		this.perks = perks;
		this.claims = claims;
	}

	@EventListener
	void on(OrganizationMerged merged) {
		perks.moveToOrganization(merged.organizationId(), merged.intoId());
		claims.moveToOrganization(merged.organizationId(), merged.intoId());
	}
}
