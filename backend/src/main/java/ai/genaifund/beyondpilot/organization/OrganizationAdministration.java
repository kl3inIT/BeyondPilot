package ai.genaifund.beyondpilot.organization;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.dto.AdminCreateOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationListRequest;
import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationListResponse;
import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.RefuseOrganizationRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Invitation;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.JoinRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Member;
import ai.genaifund.beyondpilot.organization.persistence.Organization;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with organizations: read them, approve or refuse a new one, create one for a company that is not
 * here yet, and decide who may own one nobody owns. Every operation first checks that the caller is an operator now,
 * and every change is recorded in the audit trail in the transaction of the change.
 */
@Service
public class OrganizationAdministration {

	static final int PAGE_SIZE = 25;

	private static final String ORGANIZATION = "organization";

	private final OrganizationRepository organizations;

	private final OrganizationQueryRepository organizationList;

	private final MembershipRepository memberships;

	private final IdentityService identity;

	private final EmailService email;

	private final AuditTrail audit;

	OrganizationAdministration(OrganizationRepository organizations, OrganizationQueryRepository organizationList,
			MembershipRepository memberships, IdentityService identity, EmailService email, AuditTrail audit) {
		this.organizations = organizations;
		this.organizationList = organizationList;
		this.memberships = memberships;
		this.identity = identity;
		this.email = email;
		this.audit = audit;
	}

	/**
	 * One page of the organizations the request selects: those waiting for review first, then the newest.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminOrganizationListResponse list(Actor actor, AdminOrganizationListRequest request) {
		identity.requireOperator(actor);
		String text = OrganizationViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		return new AdminOrganizationListResponse(
				organizationList.adminPage(text, request.status(), PAGE_SIZE, (long) (page - 1) * PAGE_SIZE), page,
				PAGE_SIZE, organizationList.adminCount(text, request.status()));
	}

	/**
	 * One organization with the people in it, its open invitations and the open requests to own it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist
	 */
	@Transactional(readOnly = true)
	public AdminOrganizationResponse get(Actor actor, UUID id) {
		identity.requireOperator(actor);
		return response(organizations.findById(id).orElseThrow(() -> notFound(id)));
	}

	/**
	 * Creates an approved organization nobody owns yet, and invites its owner when an address is given.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when another organization has the email domain
	 */
	@Transactional
	public AdminOrganizationResponse create(Actor actor, AdminCreateOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		String domain = request.emailDomain();
		if (domain != null && organizations.findByEmailDomain(domain).isPresent()) {
			throw new OrganizationException(OrganizationErrorCode.DOMAIN_TAKEN,
					"Second organization for one email domain");
		}
		String base = OrganizationViews.slug(request.name());
		String slug = base;
		for (int suffix = 2; organizations.existsBySlug(slug); suffix++) {
			slug = base + "-" + suffix;
		}
		Organization organization = new Organization(UUID.randomUUID(), slug, request.name().strip(),
				OrganizationViews.roles(request.roles()), request.type(), Organization.APPROVED,
				operator.accountId());
		organization.describe(request.name().strip(), OrganizationViews.roles(request.roles()), request.type(),
				OrganizationViews.text(request.website()), request.country(), null, null);
		organization.verifyDomain(domain);
		organization.approve(Instant.now());
		organizations.saveAndFlush(organization);
		record(AuditAction.ORGANIZATION_CREATE, operator, organization, Map.of());
		String ownerEmail = OrganizationViews.text(request.ownerEmail());
		if (ownerEmail != null) {
			memberships.invite(UUID.randomUUID(), organization.getId(), ownerEmail, MembershipRepository.OWNER,
					operator.accountId());
			email.sendOrganizationInvitation(ownerEmail, organization.getName(), "GenAI Fund", true);
		}
		return response(organization);
	}

	/**
	 * Approves an organization that waits for review, and tells its owners.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or does not wait for review
	 */
	@Transactional
	public void approve(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = awaitingReview(id);
		organization.approve(Instant.now());
		record(AuditAction.ORGANIZATION_APPROVE, operator, organization, Map.of());
		tellOwners(organization, true);
	}

	/**
	 * Refuses an organization that waits for review, with a reason its owners read, and tells them.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or does not wait for review
	 */
	@Transactional
	public void refuse(Actor actor, UUID id, RefuseOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = awaitingReview(id);
		organization.refuse(request.reason(), OrganizationViews.text(request.message()), Instant.now());
		record(AuditAction.ORGANIZATION_REFUSE, operator, organization, Map.of("reason", request.reason()));
		tellOwners(organization, false);
	}

	/**
	 * Decides a request to own an organization nobody owns.
	 * @param approve true makes the person its owner; false declines
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the request is not open, the organization has an owner by now, or the person
	 * joined another organization in the meantime
	 */
	@Transactional
	public void decideClaim(Actor actor, UUID requestId, boolean approve) {
		Operator operator = identity.requireOperator(actor);
		JoinRequest request = memberships.openRequest(requestId).orElseThrow(() -> requestNotFound(requestId));
		Organization organization = organizations.findForUpdate(request.organizationId()).orElseThrow();
		if (memberships.owners(organization.getId()) > 0) {
			// Its owners decide who joins an owned organization.
			throw requestNotFound(requestId);
		}
		if (approve && !memberships.add(organization.getId(), request.accountId(), MembershipRepository.OWNER)) {
			throw new OrganizationException(OrganizationErrorCode.ALREADY_MEMBER,
					"Account " + request.accountId() + " joined another organization before claim " + requestId);
		}
		if (!memberships.closeRequest(requestId, approve ? "approved" : "declined", operator.accountId())) {
			throw requestNotFound(requestId);
		}
		record(approve ? AuditAction.ORGANIZATION_CLAIM_APPROVE : AuditAction.ORGANIZATION_CLAIM_DECLINE, operator,
				organization, Map.of("account", request.accountId().toString()));
	}

	private Organization awaitingReview(UUID id) {
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		if (!organization.isPending()) {
			throw new OrganizationException(OrganizationErrorCode.NOT_AWAITING_REVIEW,
					"Decision on organization " + id + ", which is " + organization.getStatus());
		}
		return organization;
	}

	private void tellOwners(Organization organization, boolean approved) {
		List<UUID> owners = memberships.members(organization.getId())
			.stream()
			.filter(Member::isOwner)
			.map(Member::accountId)
			.toList();
		identity.people(owners)
			.values()
			.forEach(owner -> email.sendOrganizationDecision(owner.email(), organization.getName(), approved));
	}

	private AdminOrganizationResponse response(Organization organization) {
		List<Member> members = memberships.members(organization.getId());
		List<Invitation> invitations = memberships.openInvitationsOf(organization.getId());
		boolean owned = members.stream().anyMatch(Member::isOwner);
		List<JoinRequest> claims = owned ? List.of() : memberships.openRequestsTo(organization.getId());
		Map<UUID, Person> people = identity.people(Stream
			.of(members.stream().map(Member::accountId), OrganizationViews.accounts(invitations, claims).stream(),
					Stream.of(organization.getCreatedByAccountId()))
			.flatMap(accounts -> accounts)
			.distinct()
			.toList());
		Person creator = people.get(organization.getCreatedByAccountId());
		return new AdminOrganizationResponse(OrganizationViews.organization(organization),
				creator == null ? "" : creator.label(), creator == null ? "" : creator.email(),
				OrganizationViews.members(members, people, null),
				invitations.stream()
					.map(invitation -> OrganizationViews.invitation(invitation, organization.getName(), people))
					.toList(),
				claims.stream()
					.filter(claim -> people.containsKey(claim.accountId()))
					.map(claim -> OrganizationViews.joinRequest(claim, organization.getName(),
							people.get(claim.accountId()), true))
					.toList());
	}

	private void record(AuditAction action, Operator operator, Organization organization,
			Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(ORGANIZATION, organization.getId().toString(), organization.getName()),
				details));
	}

	private static OrganizationException notFound(UUID id) {
		return new OrganizationException(OrganizationErrorCode.ORGANIZATION_NOT_FOUND, "No organization " + id);
	}

	private static OrganizationException requestNotFound(UUID requestId) {
		return new OrganizationException(OrganizationErrorCode.REQUEST_NOT_FOUND, "No open claim " + requestId);
	}
}
