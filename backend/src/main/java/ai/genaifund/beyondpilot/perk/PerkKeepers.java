package ai.genaifund.beyondpilot.perk;

import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.perk.persistence.Perk;
import org.springframework.stereotype.Component;

/**
 * Who keeps a perk: the members of the organization that gives it, and GenAI Fund's operators. A perk GenAI Fund
 * arranged is changed by operators only; anyone else finds no such perk.
 */
@Component
class PerkKeepers {

	private static final String PERK = "perk";

	private final IdentityService identity;

	private final OrganizationDirectory organizations;

	private final AuditTrail audit;

	PerkKeepers(IdentityService identity, OrganizationDirectory organizations, AuditTrail audit) {
		this.identity = identity;
		this.organizations = organizations;
		this.audit = audit;
	}

	/**
	 * The caller as a keeper of the perk, to read it and answer its requests.
	 * @throws PerkException when the caller keeps no such perk
	 */
	Keeper reader(Actor actor, Perk perk) {
		identity.requireActive(actor);
		if (identity.isOperator(actor)) {
			return operator(actor);
		}
		boolean member = organizations.membershipOf(actor)
			.filter(membership -> membership.organizationId().equals(perk.getOrganizationId()))
			.isPresent();
		if (!member) {
			// Another organization's perk answers as one that does not exist.
			throw notFound(perk.getId());
		}
		Person person = identity.person(actor);
		return new Keeper(person.accountId(), person.label(), person.email(), false);
	}

	/**
	 * The caller as a keeper who may change the perk.
	 * @throws PerkException when the caller keeps no such perk, or GenAI Fund arranged it and the caller is not an
	 * operator
	 */
	Keeper writer(Actor actor, Perk perk) {
		Keeper keeper = reader(actor, perk);
		if (!keeper.operator() && perk.isFromGenAiFund()) {
			throw new PerkException(PerkErrorCode.ARRANGED,
					"Change of perk " + perk.getId() + ", which GenAI Fund arranged, by account " + actor.accountId());
		}
		return keeper;
	}

	/** @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator */
	Keeper operator(Actor actor) {
		Operator operator = identity.requireOperator(actor);
		return new Keeper(operator.accountId(), operator.label(), operator.email(), true);
	}

	/**
	 * The organization the caller acts for, whose perks they write.
	 * @throws PerkException when they belong to none
	 */
	Membership member(Actor actor) {
		identity.requireActive(actor);
		return organizations.membershipOf(actor)
			.orElseThrow(() -> new PerkException(PerkErrorCode.MEMBER_REQUIRED, "Perk by account " + actor.accountId()));
	}

	void record(AuditAction action, Keeper keeper, Perk perk, Map<String, String> details) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(keeper.accountId(), keeper.label(), keeper.email()),
				new AuditRecord.Resource(PERK, perk.getId().toString(), perk.getTitle()), details));
	}

	static PerkException notFound(UUID id) {
		return new PerkException(PerkErrorCode.NOT_FOUND, "No perk " + id + " for this caller");
	}

	/** Who acts on a perk, as its audit records them. */
	record Keeper(UUID accountId, String label, String email, boolean operator) {
	}
}
