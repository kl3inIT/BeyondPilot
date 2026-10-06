package ai.genaifund.beyondpilot.organization;

import java.util.Collection;
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

	/** The approved organization at this address, as another module shows it; empty when there is none. */
	@Transactional(readOnly = true)
	public Optional<OrganizationName> approvedAt(String slug) {
		return organizations.findBySlug(slug)
			.filter(Organization::isApproved)
			.map(organization -> new OrganizationName(organization.getId(), organization.getSlug(),
					organization.getName(), organization.getCountry()));
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
				organization.getDescription());
	}

	/** The names of the approved ones of these organizations by identifier; one taken down or in review is left out. */
	@Transactional(readOnly = true)
	public Map<UUID, OrganizationName> approvedNames(Collection<UUID> organizationIds) {
		return organizationList.approvedNames(organizationIds)
			.stream()
			.collect(Collectors.toMap(OrganizationQueryRepository.Name::id,
					name -> new OrganizationName(name.id(), name.slug(), name.name(), name.country())));
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
