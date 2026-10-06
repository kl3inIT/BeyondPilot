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
 * public page of an approved one.
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
				.map(organization -> new Membership(organization.getId(), organization.getName(), member.isOwner(),
						organization.isApproved())));
	}

	/** The accounts of everyone who belongs to the organization, owners and members alike. */
	@Transactional(readOnly = true)
	public List<UUID> memberAccountIds(UUID organizationId) {
		return memberships.members(organizationId).stream().map(member -> member.accountId()).toList();
	}

	/** Who this organization is, read now; empty when it does not exist. */
	@Transactional(readOnly = true)
	public Optional<OrganizationProfile> profile(UUID organizationId) {
		return organizations.findById(organizationId)
			.map(organization -> new OrganizationProfile(organization.getId(), organization.getSlug(),
					organization.getName(), organization.getType(), organization.getCountry(),
					organization.getTeamSize(), organization.getWebsite(), organization.isApproved()));
	}

	/** Whether GenAI Fund has approved this organization, read now. */
	@Transactional(readOnly = true)
	public boolean isApproved(UUID organizationId) {
		return organizations.findById(organizationId).filter(Organization::isApproved).isPresent();
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

	/** The approved organization at this address, as another module shows it; empty when there is none. */
	@Transactional(readOnly = true)
	public Optional<OrganizationName> approvedAt(String slug) {
		return organizations.findBySlug(slug)
			.filter(Organization::isApproved)
			.map(organization -> new OrganizationName(organization.getId(), organization.getSlug(),
					organization.getName(), organization.getCountry()));
	}

	/**
	 * The approved organization with this identifier, the kind that can have use cases; empty for one that is
	 * unknown, waits for review or was refused.
	 */
	@Transactional(readOnly = true)
	public Optional<OrganizationName> approvedOrganization(UUID id) {
		return organizations.findById(id)
			.filter(Organization::isApproved)
			.map(organization -> new OrganizationName(organization.getId(), organization.getSlug(),
					organization.getName(), organization.getCountry()));
	}

	/**
	 * The approved organizations, by name, at most {@code limit}.
	 * @param text only those whose name contains it, ignoring case; every one when blank or null
	 */
	@Transactional(readOnly = true)
	public List<OrganizationName> approvedOrganizations(@Nullable String text, int limit) {
		return organizationList.approvedOrganizations(OrganizationViews.text(text), limit)
			.stream()
			.map(name -> new OrganizationName(name.id(), name.slug(), name.name(), name.country()))
			.toList();
	}

	/**
	 * The public page of an approved organization.
	 * @throws OrganizationException when no approved organization has the address; one that waits for review or
	 * was refused answers the same, so the address does not reveal that it exists
	 */
	@Transactional(readOnly = true)
	public PublicOrganizationResponse publicPage(String slug) {
		Organization organization = organizations.findBySlug(slug)
			.filter(Organization::isApproved)
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.ORGANIZATION_NOT_FOUND,
					"No approved organization at " + slug));
		return new PublicOrganizationResponse(organization.getSlug(), organization.getName(), organization.getType(),
				organization.getCountry(), organization.getIndustries(), organization.getWebsite(),
				organization.getDescription(), organization.getLogoFileId());
	}

	/** The names of the approved ones of these organizations by identifier; one taken down or in review is left out. */
	@Transactional(readOnly = true)
	public Map<UUID, OrganizationName> approvedNames(Collection<UUID> organizationIds) {
		return organizationList.approvedNames(organizationIds)
			.stream()
			.collect(Collectors.toMap(OrganizationQueryRepository.Name::id,
					name -> new OrganizationName(name.id(), name.slug(), name.name(), name.country())));
	}

	/**
	 * The organizations whose name contains the text, ignoring case and whatever their review says, for a module that
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
					name -> new OrganizationName(name.id(), name.slug(), name.name(), name.country())));
	}
}
