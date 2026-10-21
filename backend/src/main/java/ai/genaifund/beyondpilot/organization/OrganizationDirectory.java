package ai.genaifund.beyondpilot.organization;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.organization.dto.PublicOrganizationResponse;
import ai.genaifund.beyondpilot.organization.persistence.Organization;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What other modules and visitors ask about organizations: which one a person acts for, what one is called, and the
 * public page of one that is not taken down.
 */
@Service
public class OrganizationDirectory {

	private final OrganizationRepository organizations;

	private final MembershipRepository memberships;

	private final OrganizationQueryRepository organizationList;

	OrganizationDirectory(OrganizationRepository organizations, MembershipRepository memberships,
			OrganizationQueryRepository organizationList) {
		this.organizations = organizations;
		this.memberships = memberships;
		this.organizationList = organizationList;
	}

	/** The organization the caller belongs to, read now; empty when they belong to none. */
	@Transactional(readOnly = true)
	public Optional<Membership> membershipOf(Actor actor) {
		return memberships.memberOf(actor.accountId())
			.flatMap(member -> organizations.findById(member.organizationId())
				.map(organization -> new Membership(organization.getId(), organization.getName(), organization.getType(),
						member.isOwner(), organization.isActive())));
	}

	/** The accounts of everyone who belongs to the organization, owners and members alike. */
	@Transactional(readOnly = true)
	public List<UUID> memberAccountIds(UUID organizationId) {
		return memberships.members(organizationId).stream().map(member -> member.accountId()).toList();
	}

	/**
	 * The addresses invited to own an organization whose invitations are still open, read now: who answers for an
	 * organization that nobody has taken on yet, as GenAI Fund invited the owners of the imported ones.
	 */
	@Transactional(readOnly = true)
	public List<String> invitedOwners(UUID organizationId) {
		return memberships.openInvitationsOf(organizationId)
			.stream()
			.filter(invitation -> MembershipRepository.OWNER.equals(invitation.role()))
			.map(MembershipRepository.Invitation::email)
			.toList();
	}

	/** The accounts that own an organization, read now; empty when it has no owner. */
	@Transactional(readOnly = true)
	public List<UUID> ownersOf(UUID organizationId) {
		return memberships.members(organizationId)
			.stream()
			.filter(MembershipRepository.Member::isOwner)
			.map(MembershipRepository.Member::accountId)
			.toList();
	}

	/** Who this organization is, read now; empty when it does not exist. */
	@Transactional(readOnly = true)
	public Optional<OrganizationProfile> profile(UUID organizationId) {
		return organizations.findById(organizationId)
			.map(organization -> new OrganizationProfile(organization.getId(), organization.getSlug(),
					organization.getName(), organization.getType(), organization.getCountry(),
					organization.getTeamSize(), organization.getWebsite(), organization.getFoundedYear(),
					organization.getCompanySizeLabel(), organization.getLogoFileId(), organization.isActive(), organization.getTeamBackground()));
	}

	/** Whether this organization is active, meaning not taken down and not merged, read now. */
	@Transactional(readOnly = true)
	public boolean isActive(UUID organizationId) {
		return organizations.findById(organizationId).filter(Organization::isActive).isPresent();
	}

	/** The active organization at this address, as another module shows it; empty when there is none. */
	@Transactional(readOnly = true)
	public Optional<OrganizationName> activeAt(String slug) {
		return organizations.findBySlug(slug)
			.filter(Organization::isActive)
			.map(organization -> new OrganizationName(organization.getId(), organization.getSlug(),
					organization.getName(), organization.getCountry(), organization.getLogoFileId()));
	}

	/**
	 * The active organization with this identifier, the kind that can have use cases; empty for one that is
	 * unknown, taken down or merged.
	 */
	@Transactional(readOnly = true)
	public Optional<OrganizationName> activeOrganization(UUID id) {
		return organizations.findById(id)
			.filter(Organization::isActive)
			.map(organization -> new OrganizationName(organization.getId(), organization.getSlug(),
					organization.getName(), organization.getCountry(), organization.getLogoFileId()));
	}

	/**
	 * The active organizations, by name, at most {@code limit}.
	 * @param text only those whose name contains it, ignoring case; every one when blank or null
	 */
	@Transactional(readOnly = true)
	public List<OrganizationName> activeOrganizations(@Nullable String text, int limit) {
		return organizationList.activeOrganizations(OrganizationViews.text(text), limit)
			.stream()
			.map(name -> new OrganizationName(name.id(), name.slug(), name.name(), name.country(), name.logoFileId()))
			.toList();
	}

	/**
	 * The public page of an active organization. The address of a merged one answers with the organization it was
	 * merged into, whose own address the page then shows.
	 * @throws OrganizationException when no active organization has the address; one that is taken down
	 * answers the same, so the address does not reveal that it exists
	 */
	@Transactional(readOnly = true)
	public PublicOrganizationResponse publicPage(String slug) {
		Organization organization = organizations.findBySlug(slug)
			.flatMap(found -> found.isMerged()
					? Optional.ofNullable(found.getMergedIntoId()).flatMap(organizations::findById) : Optional.of(found))
			.filter(Organization::isActive)
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.ORGANIZATION_NOT_FOUND,
					"No active organization at " + slug));
		return new PublicOrganizationResponse(organization.getSlug(), organization.getName(), organization.getType(),
				organization.getCountry(), organization.getIndustries(), organization.getWebsite(),
				organization.getDescription(), organization.getLogoFileId());
	}

	/** The names of the active ones of these organizations by identifier; one taken down is left out. */
	@Transactional(readOnly = true)
	public Map<UUID, OrganizationName> activeNames(Collection<UUID> organizationIds) {
		return organizationList.activeNames(organizationIds)
			.stream()
			.collect(Collectors.toMap(OrganizationQueryRepository.Name::id,
					name -> new OrganizationName(name.id(), name.slug(), name.name(), name.country(), name.logoFileId())));
	}

	/**
	 * The organizations whose name contains the text, ignoring case and whether they are taken down, for a module that
	 * searches its own records by who they belong to.
	 */
	@Transactional(readOnly = true)
	public List<UUID> named(String text) {
		return organizationList.idsNamed(text);
	}

	/** The names of these organizations by identifier; an unknown one is left out. */
	@Transactional(readOnly = true)
	public Map<UUID, OrganizationName> names(Collection<UUID> organizationIds) {
		return organizationList.names(organizationIds)
			.stream()
			.collect(Collectors.toMap(OrganizationQueryRepository.Name::id,
					name -> new OrganizationName(name.id(), name.slug(), name.name(), name.country(), name.logoFileId())));
	}
}
