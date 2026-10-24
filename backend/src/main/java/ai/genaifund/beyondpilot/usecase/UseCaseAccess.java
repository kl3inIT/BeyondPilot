package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAccessCandidateResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAccessPersonResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAccessResponse;
import ai.genaifund.beyondpilot.usecase.persistence.AccessRole;
import ai.genaifund.beyondpilot.usecase.persistence.UseCase;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseAccessRepository;
import org.springframework.stereotype.Component;

/**
 * Who may do what with a use case, set one by one like sharing a file. The creator and the owners of the
 * organization may do everything and cannot be changed; every other member has what the use case gives all members,
 * and what they were given by name, whichever is more. A public use case may be read by every member; GenAI Fund
 * works with every use case.
 */
@Component
class UseCaseAccess {

	private static final String USE_CASE = "use_case";

	private final UseCaseAccessRepository grants;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final AuditTrail audit;

	UseCaseAccess(UseCaseAccessRepository grants, OrganizationDirectory organizations, IdentityService identity,
			AuditTrail audit) {
		this.grants = grants;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
	}

	/** What a member may do with a use case of their organization; {@link AccessRole#NONE} when it is not theirs to see. */
	AccessRole roleOf(Actor actor, Membership membership, UseCase useCase) {
		return roleOf(actor, membership, useCase, grants.roleOf(useCase.getId(), actor.accountId()).orElse(AccessRole.NONE));
	}

	/** The same, for a member whose own role in the use case is already known: they hold {@code given}. */
	AccessRole roleOf(Actor actor, Membership membership, UseCase useCase, AccessRole given) {
		if (membership.owner() || useCase.getCreatedByAccountId().equals(actor.accountId())) {
			return AccessRole.FULL_ACCESS;
		}
		AccessRole role = useCase.getMemberAccess().or(given);
		if (role == AccessRole.NONE && UseCase.APPROVED.equals(useCase.getStatus())) {
			return AccessRole.VIEWER;
		}
		return role;
	}

	/** The roles a member was given by name, by use case, for a list that has to decide on many at once. */
	Map<UUID, AccessRole> givenTo(Actor actor) {
		return grants.rolesOf(actor.accountId());
	}

	/** Who may do what with the use case, as the caller reads it. */
	UseCaseAccessResponse read(Actor viewer, UseCase useCase, AccessRole yourAccess) {
		Map<UUID, UseCaseAccessRepository.Grant> given = new LinkedHashMap<>();
		for (UseCaseAccessRepository.Grant grant : grants.grants(useCase.getId())) {
			given.put(grant.accountId(), grant);
		}
		Set<UUID> owners = new LinkedHashSet<>(organizations.ownersOf(useCase.getOrganizationId()));
		UUID creator = useCase.getCreatedByAccountId();
		Set<UUID> ids = new LinkedHashSet<>();
		ids.add(creator);
		ids.addAll(owners);
		ids.addAll(given.keySet());
		Set<UUID> everyone = new LinkedHashSet<>(organizations.memberAccountIds(useCase.getOrganizationId()));
		Set<UUID> namedIds = new LinkedHashSet<>(ids);
		namedIds.addAll(everyone);
		Map<UUID, Person> named = identity.people(namedIds);

		List<UseCaseAccessPersonResponse> people = new ArrayList<>();
		for (UUID id : ids) {
			Person person = named.get(id);
			UseCaseAccessRepository.Grant grant = given.get(id);
			boolean fixed = id.equals(creator) || owners.contains(id);
			AccessRole role = fixed || grant == null ? AccessRole.FULL_ACCESS : grant.role();
			people.add(new UseCaseAccessPersonResponse(id, person == null ? "" : person.label(),
					person == null ? "" : person.email(), role.code(), id.equals(creator), owners.contains(id),
					id.equals(viewer.accountId()), fixed || grant == null ? null : nameOf(named, grant.addedByAccountId()),
					fixed || grant == null ? null : grant.createdAt()));
		}
		List<UseCaseAccessCandidateResponse> candidates = new ArrayList<>();
		for (UUID id : everyone) {
			Person person = named.get(id);
			if (!ids.contains(id) && person != null) {
				candidates.add(new UseCaseAccessCandidateResponse(id, person.label(), person.email()));
			}
		}
		candidates.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
		return new UseCaseAccessResponse(yourAccess.code(), useCase.getMemberAccess().code(), people, candidates);
	}

	/**
	 * Gives a member of the organization a role in the use case, or changes the one they have.
	 * @throws UseCaseException when the person is not a member, or is the creator or an owner
	 */
	void grant(Actor changer, UseCase useCase, UUID accountId, AccessRole role) {
		requireChangeable(useCase, accountId);
		if (!organizations.memberAccountIds(useCase.getOrganizationId()).contains(accountId)) {
			throw new UseCaseException(UseCaseErrorCode.ACCESS_NOT_A_MEMBER,
					"Account " + accountId + " is not a member of the organization of use case " + useCase.getId());
		}
		grants.set(useCase.getId(), accountId, role, changer.accountId(), Instant.now());
		record(AuditAction.USE_CASE_ACCESS_SET, changer, useCase, Map.of("organization",
				useCase.getOrganizationId().toString(), "account", accountId.toString(), "role", role.code()));
	}

	/**
	 * Takes the role away from a member; what every member may do still applies to them.
	 * @throws UseCaseException when the person is the creator or an owner
	 */
	void revoke(Actor changer, UseCase useCase, UUID accountId) {
		requireChangeable(useCase, accountId);
		if (grants.remove(useCase.getId(), accountId)) {
			record(AuditAction.USE_CASE_ACCESS_REMOVE, changer, useCase,
					Map.of("organization", useCase.getOrganizationId().toString(), "account", accountId.toString()));
		}
	}

	/** Sets what every other member of the organization may do with the use case. */
	void shareWithMembers(Actor changer, UseCase useCase, AccessRole role) {
		if (useCase.getMemberAccess() != role) {
			useCase.shareWithMembers(role);
			record(AuditAction.USE_CASE_ACCESS_GENERAL, changer, useCase,
					Map.of("organization", useCase.getOrganizationId().toString(), "role", role.code()));
		}
	}

	private void requireChangeable(UseCase useCase, UUID accountId) {
		if (accountId.equals(useCase.getCreatedByAccountId())
				|| organizations.ownersOf(useCase.getOrganizationId()).contains(accountId)) {
			throw new UseCaseException(UseCaseErrorCode.ACCESS_FIXED,
					"Account " + accountId + " created or owns use case " + useCase.getId());
		}
	}

	private static String nameOf(Map<UUID, Person> named, UUID accountId) {
		Person person = named.get(accountId);
		return person == null ? "" : person.label();
	}

	private void record(AuditAction action, Actor actor, UseCase useCase, Map<String, String> details) {
		Person person = identity.person(actor);
		audit.record(new AuditRecord(action, new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(),
						useCase.getTitle() != null ? useCase.getTitle() : "Untitled use case"),
				details));
	}

}
