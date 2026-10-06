package ai.genaifund.beyondpilot.organization;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationSummaryResponse;
import ai.genaifund.beyondpilot.organization.dto.AdminSaveOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.ApproveOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.InviteMemberRequest;
import ai.genaifund.beyondpilot.organization.dto.RefuseOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.SaveOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.SendBackOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.TakeDownOrganizationRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Invitation;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.JoinRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Member;
import ai.genaifund.beyondpilot.organization.persistence.Organization;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository.AdminRow;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
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

	private final OrganizationLogos logos;

	private final ApplicationEventPublisher events;

	OrganizationAdministration(OrganizationRepository organizations, OrganizationQueryRepository organizationList,
			MembershipRepository memberships, IdentityService identity, EmailService email, AuditTrail audit,
			OrganizationLogos logos, ApplicationEventPublisher events) {
		this.organizations = organizations;
		this.organizationList = organizationList;
		this.memberships = memberships;
		this.identity = identity;
		this.email = email;
		this.audit = audit;
		this.logos = logos;
		this.events = events;
	}

	/**
	 * One page of the organizations the request selects: those a decision waits on first, then the newest. Each says
	 * what waits, a new organization or a claim, and who asked.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminOrganizationListResponse list(Actor actor, AdminOrganizationListRequest request) {
		identity.requireOperator(actor);
		String text = OrganizationViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		List<AdminRow> rows = organizationList.adminPage(text, request.status(), PAGE_SIZE,
				(long) (page - 1) * PAGE_SIZE);
		Map<UUID, Person> askers = identity.people(rows.stream()
			.map(OrganizationAdministration::asker)
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		return new AdminOrganizationListResponse(rows.stream().map(row -> summary(row, askers)).toList(), page,
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
		UUID logo = request.logoFileId();
		if (logo != null) {
			logos.requireUsable(actor, logo);
		}
		String base = OrganizationViews.slug(request.name());
		String slug = base;
		for (int suffix = 2; organizations.existsBySlug(slug); suffix++) {
			slug = base + "-" + suffix;
		}
		Organization organization = new Organization(UUID.randomUUID(), slug, request.name().strip(),
				request.type(), Organization.APPROVED, operator.accountId());
		List<String> industries = request.industries() == null ? List.of() : request.industries();
		organization.describe(request.name().strip(), request.type(), OrganizationViews.text(request.website()),
				request.country(), request.teamSize(), industries, OrganizationViews.text(request.description()),
				request.foundedYear(), logo);
		organization.verifyDomain(domain);
		organization.approve(Instant.now());
		organizations.saveAndFlush(organization);
		record(AuditAction.ORGANIZATION_CREATE, operator, organization, Map.of());
		String ownerEmail = OrganizationViews.text(request.ownerEmail());
		if (ownerEmail != null) {
			memberships.invite(UUID.randomUUID(), organization.getId(), ownerEmail, MembershipRepository.OWNER,
					operator.accountId(), true, OrganizationService.INVITATION_LIFETIME);
			email.sendOrganizationInvitation(ownerEmail, organization.getName(), "GenAI Fund", true);
		}
		return response(organization);
	}

	/**
	 * Approves an organization that waits for review, with the email domain the operator verified for it when they
	 * did, and tells its owners.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or does not wait for review, or another
	 * organization has the domain
	 */
	@Transactional
	public void approve(Actor actor, UUID id, ApproveOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = awaitingReview(id);
		verifyDomain(organization, request.emailDomain());
		organization.approve(Instant.now());
		record(AuditAction.ORGANIZATION_APPROVE, operator, organization, Map.of());
		events.publishEvent(new OrganizationChanged(organization.getId()));
		tellOwners(organization, true);
	}

	/**
	 * Refuses an organization that waits for review for good, with a reason its owners read, and tells them. Missing
	 * information is a send back instead.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or does not wait for review
	 */
	@Transactional
	public void refuse(Actor actor, UUID id, RefuseOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = awaitingReview(id);
		organization.refuse(request.reason(), OrganizationViews.text(request.message()), Instant.now());
		record(AuditAction.ORGANIZATION_REFUSE, operator, organization, Map.of("reason", request.reason()));
		events.publishEvent(new OrganizationChanged(organization.getId()));
		tellOwners(organization, false);
	}

	/**
	 * Sends an organization that waits for review back to its owners with what to change, and tells them. They
	 * correct it and it waits for review again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or does not wait for review
	 */
	@Transactional
	public void sendBack(Actor actor, UUID id, SendBackOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = awaitingReview(id);
		String reason = request.reason().strip();
		organization.sendBack(reason, Instant.now());
		record(AuditAction.ORGANIZATION_SEND_BACK, operator, organization, Map.of());
		events.publishEvent(new OrganizationChanged(organization.getId()));
		owners(organization)
			.forEach(owner -> email.sendOrganizationSentBack(owner.email(), organization.getName(), reason));
	}

	/**
	 * Saves the profile and the verified domain of an organization, whatever its status. An organization may be left
	 * without a domain, which also turns off joining at once.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or changed since it was read, or another
	 * organization has the domain
	 */
	@Transactional
	public AdminOrganizationResponse save(Actor actor, UUID id, AdminSaveOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		SaveOrganizationRequest profile = request.profile();
		if (organization.getVersion() != profile.version()) {
			throw new OrganizationException(OrganizationErrorCode.CHANGED_MEANWHILE,
					"Operator save of organization " + id + " at version " + profile.version() + ", which is at "
							+ organization.getVersion());
		}
		UUID formerLogo = organization.getLogoFileId();
		UUID logo = profile.logoFileId();
		if (logo != null && !logo.equals(formerLogo)) {
			logos.requireUsable(actor, logo);
		}
		organization.describe(profile.name().strip(), profile.type(), OrganizationViews.text(profile.website()),
				profile.country(), profile.teamSize(), OrganizationViews.codes(profile.industries()),
				OrganizationViews.text(profile.description()), profile.foundedYear(), logo);
		String domain = request.emailDomain();
		if (!Objects.equals(domain, organization.getEmailDomain())) {
			if (domain != null && organizations.findByEmailDomain(domain).isPresent()) {
				throw new OrganizationException(OrganizationErrorCode.DOMAIN_TAKEN,
						"Domain of organization " + id + " set to one another organization has");
			}
			organization.verifyDomain(domain);
		}
		organizations.flush();
		events.publishEvent(new OrganizationChanged(organization.getId()));
		logos.discardReplaced(formerLogo, logo);
		record(AuditAction.ORGANIZATION_UPDATE, operator, organization, Map.of());
		return response(organization);
	}

	/**
	 * Makes a member of any organization an owner, or an owner a member. An operator may leave an organization
	 * without an owner: that is how a page is handed to someone else.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or the person does not belong to it
	 */
	@Transactional
	public void changeMemberRole(Actor actor, UUID id, UUID accountId, String role) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		Member target = member(organization, accountId);
		if (target.role().equals(role)) {
			return;
		}
		memberships.changeRole(id, accountId, role);
		record(AuditAction.ORGANIZATION_MEMBER_ROLE, operator, organization,
				Map.of("account", accountId.toString(), "role", role));
	}

	/**
	 * Takes a person out of any organization, the last owner included.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or the person does not belong to it
	 */
	@Transactional
	public void removeMember(Actor actor, UUID id, UUID accountId) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		member(organization, accountId);
		memberships.remove(id, accountId);
		record(AuditAction.ORGANIZATION_MEMBER_REMOVE, operator, organization, Map.of("account", accountId.toString()));
	}

	/**
	 * Asks an address to own or join an organization and tells it by email. An operator's invitations stay out of the
	 * organization's daily and open limits.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist, the address already belongs to it, or it
	 * already holds an open invitation
	 */
	@Transactional
	public void invite(Actor actor, UUID id, InviteMemberRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		String address = request.email().strip();
		List<UUID> accounts = memberships.members(id).stream().map(Member::accountId).toList();
		if (identity.people(accounts).values().stream().anyMatch(person -> person.email().equalsIgnoreCase(address))) {
			throw new OrganizationException(OrganizationErrorCode.INVITEE_IS_MEMBER,
					"Operator invitation of a member of organization " + id);
		}
		if (!memberships.invite(UUID.randomUUID(), id, address, request.role(), operator.accountId(), true,
				OrganizationService.INVITATION_LIFETIME)) {
			throw new OrganizationException(OrganizationErrorCode.ALREADY_INVITED,
					"Second open invitation of one address to organization " + id);
		}
		email.sendOrganizationInvitation(address, organization.getName(), "GenAI Fund",
				MembershipRepository.OWNER.equals(request.role()));
		record(AuditAction.ORGANIZATION_INVITE, operator, organization, Map.of("role", request.role()));
	}

	/**
	 * Takes back an open invitation of an organization.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or the invitation is not one of its open ones
	 */
	@Transactional
	public void revokeInvitation(Actor actor, UUID id, UUID invitationId) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findById(id).orElseThrow(() -> notFound(id));
		memberships.openInvitation(invitationId)
			.filter(invitation -> invitation.organizationId().equals(id))
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.INVITATION_NOT_FOUND,
					"Invitation " + invitationId + " is not an open one of organization " + id));
		memberships.closeInvitation(invitationId, "revoked");
		record(AuditAction.ORGANIZATION_INVITATION_REVOKE, operator, organization, Map.of());
	}

	/**
	 * Takes an approved organization down, with a reason its owners read, and tells them. Its members keep their
	 * workspace; it leaves the directories until it is restored.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist, is not approved or is down already
	 */
	@Transactional
	public void takeDown(Actor actor, UUID id, TakeDownOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		if (!organization.isApproved()) {
			throw new OrganizationException(OrganizationErrorCode.CANNOT_TAKE_DOWN,
					"Take-down of organization " + id + ", which is " + organization.getStatus()
							+ (organization.isSuspended() ? " and down" : ""));
		}
		organization.suspend(request.reason(), OrganizationViews.text(request.message()), Instant.now());
		record(AuditAction.ORGANIZATION_SUSPEND, operator, organization, Map.of("reason", request.reason()));
		events.publishEvent(new OrganizationChanged(organization.getId()));
		tellOwnersOfSuspension(organization, true);
	}

	/**
	 * Returns a taken-down organization to the directories, and tells its owners.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or is not taken down
	 */
	@Transactional
	public void restore(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		if (!organization.isSuspended()) {
			throw new OrganizationException(OrganizationErrorCode.NOT_TAKEN_DOWN,
					"Restore of organization " + id + ", which is " + organization.getStatus());
		}
		organization.restore();
		record(AuditAction.ORGANIZATION_RESTORE, operator, organization, Map.of());
		events.publishEvent(new OrganizationChanged(organization.getId()));
		tellOwnersOfSuspension(organization, false);
	}

	/**
	 * Lets a person own an organization nobody owns, with the email domain the operator verified for it when they
	 * did, and tells the person. The other claims on it become requests its new owner decides.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the claim is not open, the organization has an owner by now, the person
	 * joined another organization in the meantime, or another organization has the domain
	 */
	@Transactional
	public void approveClaim(Actor actor, UUID requestId, ApproveOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		JoinRequest claim = openClaim(requestId);
		Organization organization = organizations.findForUpdate(claim.organizationId()).orElseThrow();
		verifyDomain(organization, request.emailDomain());
		if (!memberships.add(organization.getId(), claim.accountId(), MembershipRepository.OWNER)) {
			throw new OrganizationException(OrganizationErrorCode.ALREADY_MEMBER,
					"Account " + claim.accountId() + " joined another organization before claim " + requestId);
		}
		closeClaim(operator, organization, claim, true);
		memberships.claimsBecomeRequests(organization.getId());
	}

	/**
	 * Declines a request to own an organization nobody owns, and tells the person.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the claim is not open, or the organization has an owner by now
	 */
	@Transactional
	public void declineClaim(Actor actor, UUID requestId) {
		Operator operator = identity.requireOperator(actor);
		JoinRequest claim = openClaim(requestId);
		closeClaim(operator, organizations.findForUpdate(claim.organizationId()).orElseThrow(), claim, false);
	}

	/** A request that operators decide; one to an owned organization is its owners' to decide. */
	private JoinRequest openClaim(UUID requestId) {
		return memberships.openRequest(requestId)
			.filter(JoinRequest::claim)
			.orElseThrow(() -> requestNotFound(requestId));
	}

	private void closeClaim(Operator operator, Organization organization, JoinRequest claim, boolean approved) {
		if (!memberships.closeRequest(claim.id(), approved ? "approved" : "declined", operator.accountId())) {
			throw requestNotFound(claim.id());
		}
		record(approved ? AuditAction.ORGANIZATION_CLAIM_APPROVE : AuditAction.ORGANIZATION_CLAIM_DECLINE, operator,
				organization, Map.of("account", claim.accountId().toString()));
		Person claimant = identity.people(List.of(claim.accountId())).get(claim.accountId());
		if (claimant != null) {
			email.sendOrganizationRequestDecision(claimant.email(), organization.getName(), true, approved);
		}
	}

	/** Records the domain the operator vouches for; none leaves the organization as it is. */
	private void verifyDomain(Organization organization, @Nullable String domain) {
		if (domain == null || domain.equals(organization.getEmailDomain())) {
			return;
		}
		if (organizations.findByEmailDomain(domain).isPresent()) {
			throw new OrganizationException(OrganizationErrorCode.DOMAIN_TAKEN,
					"Domain of organization " + organization.getId() + " set to one another organization has");
		}
		organization.verifyDomain(domain);
	}

	private Member member(Organization organization, UUID accountId) {
		return memberships.memberOf(accountId)
			.filter(found -> found.organizationId().equals(organization.getId()))
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.MEMBER_NOT_FOUND,
					"Account " + accountId + " is not in organization " + organization.getId()));
	}

	private Organization awaitingReview(UUID id) {
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		if (!organization.isInReview()) {
			throw new OrganizationException(OrganizationErrorCode.NOT_AWAITING_REVIEW,
					"Decision on organization " + id + ", which is " + organization.getStatus());
		}
		return organization;
	}

	private void tellOwners(Organization organization, boolean approved) {
		owners(organization)
			.forEach(owner -> email.sendOrganizationDecision(owner.email(), organization.getName(), approved));
	}

	private void tellOwnersOfSuspension(Organization organization, boolean takenDown) {
		owners(organization)
			.forEach(owner -> email.sendOrganizationSuspension(owner.email(), organization.getName(), takenDown));
	}

	private Collection<Person> owners(Organization organization) {
		List<UUID> owners = memberships.members(organization.getId())
			.stream()
			.filter(Member::isOwner)
			.map(Member::accountId)
			.toList();
		return identity.people(owners).values();
	}

	private AdminOrganizationResponse response(Organization organization) {
		List<Member> members = memberships.members(organization.getId());
		List<Invitation> invitations = memberships.openInvitationsOf(organization.getId());
		List<JoinRequest> claims = memberships.openRequestsTo(organization.getId())
			.stream()
			.filter(JoinRequest::claim)
			.toList();
		Map<UUID, Person> people = identity.people(Stream
			.of(members.stream().map(Member::accountId), OrganizationViews.accounts(invitations, claims).stream(),
					Stream.of(organization.getCreatedByAccountId()))
			.flatMap(accounts -> accounts)
			.distinct()
			.toList());
		Person creator = people.get(organization.getCreatedByAccountId());
		return new AdminOrganizationResponse(OrganizationViews.organization(organization),
				creator == null ? "" : creator.label(), creator == null ? "" : creator.email(),
				suggestedDomain(organization, creator), OrganizationViews.members(members, people, null),
				invitations.stream()
					.map(invitation -> OrganizationViews.invitation(invitation, organization.getName(), people))
					.toList(),
				claims.stream()
					.filter(claim -> people.containsKey(claim.accountId()))
					.map(claim -> OrganizationViews.joinRequest(claim, organization, people.get(claim.accountId())))
					.toList());
	}

	/**
	 * A domain the operator only has to confirm: the one the organization has, else its creator's work domain while
	 * it waits for review, else its website's. None when another organization holds it.
	 */
	private @Nullable String suggestedDomain(Organization organization, @Nullable Person creator) {
		if (organization.getEmailDomain() != null) {
			return organization.getEmailDomain();
		}
		String fromCreator = organization.isInReview() && creator != null
				? OrganizationViews.workDomain(creator.email()) : null;
		String candidate = fromCreator != null ? fromCreator
				: OrganizationViews.websiteDomain(organization.getWebsite());
		return candidate == null || organizations.findByEmailDomain(candidate).isPresent() ? null : candidate;
	}

	/** Who asked for what waits on the row: the claimant of its open claim, else its creator while it is reviewed. */
	private static @Nullable UUID asker(AdminRow row) {
		if (row.claimantAccountId() != null) {
			return row.claimantAccountId();
		}
		return Organization.IN_REVIEW.equals(row.status()) ? row.createdByAccountId() : null;
	}

	private static AdminOrganizationSummaryResponse summary(AdminRow row, Map<UUID, Person> askers) {
		UUID askerId = asker(row);
		Person asker = askerId == null ? null : askers.get(askerId);
		String request = null;
		if (Organization.IN_REVIEW.equals(row.status())) {
			request = "new";
		}
		else if (row.claimId() != null) {
			request = "claim";
		}
		return new AdminOrganizationSummaryResponse(row.id(), row.slug(), row.name(), row.type(),
				row.country(), row.status(), row.suspendedAt(), row.members(), row.owned(), request, row.claimId(),
				asker == null ? null : asker.label(), row.claimedAt() != null ? row.claimedAt()
						: request == null ? null : row.createdAt(),
				row.createdAt());
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
