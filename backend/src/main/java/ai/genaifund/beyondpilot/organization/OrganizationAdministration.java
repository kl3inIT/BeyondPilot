package ai.genaifund.beyondpilot.organization;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import ai.genaifund.beyondpilot.organization.dto.MergedOrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.MergeOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.OrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationReviewQueueResponse;
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
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

	private static final Logger LOG = LoggerFactory.getLogger(OrganizationAdministration.class);

	/** The days of a review queue are Vietnam's, as the screens show them. */
	private static final ZoneId QUEUE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

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
	 * One page of the organizations the request selects, in the order it asks for; without one, those a decision
	 * waits on first, then the newest. Each says what waits, a new organization or a claim, and who asked.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminOrganizationListResponse list(Actor actor, AdminOrganizationListRequest request) {
		identity.requireOperator(actor);
		String text = OrganizationViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		List<AdminRow> rows = organizationList.adminPage(text, request.status(), request.country(), request.sort(),
				size, (long) (page - 1) * size);
		Map<UUID, Person> askers = identity.people(rows.stream()
			.map(OrganizationAdministration::asker)
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		return new AdminOrganizationListResponse(rows.stream().map(row -> summary(row, askers)).toList(), page,
				size, organizationList.adminCount(text, request.status(), request.country()),
				organizationList.adminCountries());
	}

	/**
	 * Organizations as a spreadsheet: every page of the list as the request narrows it, in its order, for GenAI Fund to work
	 * with outside BeyondPilot. The download is recorded.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, AdminOrganizationListRequest request, SpreadsheetFormat format) {
		Operator operator = identity.requireOperator(actor);
		List<AdminOrganizationSummaryResponse> rows = Spreadsheet
			.everyPage(page -> list(actor, new AdminOrganizationListRequest(request.q(), request.status(), request.country(), request.sort(), page,
					Spreadsheet.PAGE_SIZE)).items());
		Spreadsheet<AdminOrganizationSummaryResponse> sheet = Spreadsheet.<AdminOrganizationSummaryResponse>of("Organizations")
			.text("Organization", AdminOrganizationSummaryResponse::name)
			.label("Type", AdminOrganizationSummaryResponse::type)
			.text("Country", AdminOrganizationSummaryResponse::country)
			.label("Status", AdminOrganizationSummaryResponse::status)
			.count("Members", AdminOrganizationSummaryResponse::members)
			.yesNo("Has an owner", AdminOrganizationSummaryResponse::owned)
			.group("Waiting on GenAI Fund")
			.label("Request", AdminOrganizationSummaryResponse::request)
			.text("Asked by", AdminOrganizationSummaryResponse::askedBy)
			.time("Asked at", AdminOrganizationSummaryResponse::requestedAt)
			.ungrouped()
			.time("Created at", AdminOrganizationSummaryResponse::createdAt)
			.time("Taken down at", AdminOrganizationSummaryResponse::suspendedAt)
			.text("Merged into", AdminOrganizationSummaryResponse::mergedInto)
			.text("Address", AdminOrganizationSummaryResponse::slug);
		SpreadsheetFile file = sheet.write(format, "organizations", rows,
				Spreadsheet.About.of(operator.label(), Instant.now())
					.narrowedBy("Search", request.q())
					.narrowedBy("Status", request.status())
					.narrowedBy("Country", request.country())
					.narrowedBy("Order", request.sort()));
		audit.record(new AuditRecord(AuditAction.ORGANIZATION_EXPORT,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("organization_list", "organizations", "Organizations"), Map.of("count", String.valueOf(file.rows()))));
		LOG.atInfo()
			.addKeyValue("event", "organization.list.exported")
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Organizations exported");
		return file;
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
		if (domain != null && Organization.INDIVIDUAL.equals(request.type())) {
			throw individualDomain();
		}
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
		organization.describeTeam(OrganizationViews.text(request.teamBackground()));
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
	 * @throws OrganizationException when the organization does not exist, was merged or changed since it was read, or
	 * another organization has the domain
	 */
	@Transactional
	public AdminOrganizationResponse save(Actor actor, UUID id, AdminSaveOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = changeable(id);
        SaveOrganizationRequest profile = request.profile();
        if ("company".equals(profile.type()) && profile.industries().isEmpty()) {
            throw new OrganizationException(OrganizationErrorCode.INDUSTRIES_REQUIRED,
                    "Company profile saved without an industry");
        }
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
		organization.describeTeam(OrganizationViews.text(profile.teamBackground()));
		String domain = request.emailDomain();
		if (!Objects.equals(domain, organization.getEmailDomain())) {
			if (domain != null && organization.isIndividual()) {
				throw individualDomain();
			}
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
	 * without an owner: that is how a page is handed to someone else. The open requests follow: GenAI Fund decides
	 * them while nobody owns the organization, its owners once it has one.
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
		handRequests(id);
		record(AuditAction.ORGANIZATION_MEMBER_ROLE, operator, organization,
				Map.of("account", accountId.toString(), "role", role));
	}

	/**
	 * Takes a person out of any organization, the last owner included, after whom GenAI Fund decides its open
	 * requests.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or the person does not belong to it
	 */
	@Transactional
	public void removeMember(Actor actor, UUID id, UUID accountId) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		member(organization, accountId);
		memberships.remove(id, accountId);
		handRequests(id);
		record(AuditAction.ORGANIZATION_MEMBER_REMOVE, operator, organization, Map.of("account", accountId.toString()));
	}

	/**
	 * Asks an address to own or join an organization and tells it by email. An operator's invitations stay out of the
	 * organization's daily and open limits.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist or was merged, the address already belongs
	 * to it, or it already holds an open invitation
	 */
	@Transactional
	public void invite(Actor actor, UUID id, InviteMemberRequest request) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = changeable(id);
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
	 * @throws OrganizationException when the organization does not exist, was merged or is not taken down
	 */
	@Transactional
	public void restore(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Organization organization = changeable(id);
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
	 * Merges a duplicate organization into the one to keep, in one transaction. Its people move as members and are
	 * told by email, its open invitations move as invitations to join as a member, its requests move, and the modules
	 * that keep records of organizations move theirs. The kept organization takes the duplicate's domain when it has
	 * none. The duplicate stays as a record of where it went, which nobody changes.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when either organization does not exist, they are the same, the duplicate was
	 * merged, or the one to keep is not approved and shown
	 */
	@Transactional
	public void merge(Actor actor, UUID id, MergeOrganizationRequest request) {
		Operator operator = identity.requireOperator(actor);
		UUID intoId = request.intoId();
		if (id.equals(intoId)) {
			throw new OrganizationException(OrganizationErrorCode.CANNOT_MERGE,
					"Merge of organization " + id + " into itself");
		}
		boolean duplicateFirst = id.compareTo(intoId) < 0;
		Organization first = organizations.findForUpdate(duplicateFirst ? id : intoId)
			.orElseThrow(() -> notFound(duplicateFirst ? id : intoId));
		Organization second = organizations.findForUpdate(duplicateFirst ? intoId : id)
			.orElseThrow(() -> notFound(duplicateFirst ? intoId : id));
		Organization duplicate = duplicateFirst ? first : second;
		Organization kept = duplicateFirst ? second : first;
		if (duplicate.isMerged() || !kept.isApproved()) {
			throw new OrganizationException(OrganizationErrorCode.CANNOT_MERGE, "Merge of organization " + id + " into "
					+ intoId + ", which is " + kept.getStatus() + (kept.isSuspended() ? " and down" : ""));
		}
		Collection<Person> people = identity.people(memberships.members(id).stream().map(Member::accountId).toList())
			.values();
		memberships.moveMembers(id, intoId);
		memberships.moveOpenInvitations(id, intoId);
		memberships.moveOpenRequests(id, intoId, memberships.owners(intoId) == 0);
		String domain = duplicate.getEmailDomain();
		duplicate.mergeInto(intoId, operator.accountId(), Instant.now());
		organizations.flush();
		if (domain != null && kept.getEmailDomain() == null) {
			kept.verifyDomain(domain);
		}
		record(AuditAction.ORGANIZATION_MERGE, operator, duplicate, Map.of("into", intoId.toString()));
		events.publishEvent(new OrganizationMerged(id, intoId));
		events.publishEvent(new OrganizationChanged(id));
		events.publishEvent(new OrganizationChanged(intoId));
		people.forEach(person -> email.sendOrganizationMerged(person.email(), duplicate.getName(), kept.getName()));
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
		Organization organization = claimed(requestId);
		JoinRequest claim = claimOn(organization, requestId);
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
		Organization organization = claimed(requestId);
		closeClaim(operator, organization, claimOn(organization, requestId), false);
	}

	/** The organization a claim is on, locked; the claim is then read again with {@link #claimOn}. */
	private Organization claimed(UUID requestId) {
		return organizations.findForUpdate(openClaim(requestId).organizationId()).orElseThrow();
	}

	/**
	 * The claim as it is once its organization is locked. An owner who arrived before the lock made it a request, and
	 * a merge moved it to the organization kept; either way it is no longer a claim on this one.
	 */
	private JoinRequest claimOn(Organization organization, UUID requestId) {
		JoinRequest claim = openClaim(requestId);
		if (!claim.organizationId().equals(organization.getId())) {
			throw requestNotFound(requestId);
		}
		return claim;
	}

	/** Gives the open requests to whoever decides them now: GenAI Fund without an owner, the owners with one. */
	private void handRequests(UUID organizationId) {
		if (memberships.owners(organizationId) == 0) {
			memberships.requestsBecomeClaims(organizationId);
		}
		else {
			memberships.claimsBecomeRequests(organizationId);
		}
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
		if (organization.isIndividual()) {
			throw individualDomain();
		}
		if (organizations.findByEmailDomain(domain).isPresent()) {
			throw new OrganizationException(OrganizationErrorCode.DOMAIN_TAKEN,
					"Domain of organization " + organization.getId() + " set to one another organization has");
		}
		organization.verifyDomain(domain);
	}

	private static OrganizationException individualDomain() {
		return new OrganizationException(OrganizationErrorCode.INDIVIDUAL, "Email domain given to an individual");
	}

	private Member member(Organization organization, UUID accountId) {
		return memberships.memberOf(accountId)
			.filter(found -> found.organizationId().equals(organization.getId()))
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.MEMBER_NOT_FOUND,
					"Account " + accountId + " is not in organization " + organization.getId()));
	}

	/** An organization an operator may still change: one that was not merged into another. */
	private Organization changeable(UUID id) {
		Organization organization = organizations.findForUpdate(id).orElseThrow(() -> notFound(id));
		if (organization.isMerged()) {
			throw new OrganizationException(OrganizationErrorCode.MERGED,
					"Change of organization " + id + ", which was merged into " + organization.getMergedIntoId());
		}
		return organization;
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
			.forEach(owner -> email.sendOrganizationDecision(owner.email(), organization.getName(),
					organization.getSlug(), approved));
	}

	private void tellOwnersOfSuspension(Organization organization, boolean takenDown) {
		owners(organization)
			.forEach(owner -> email.sendOrganizationSuspension(owner.email(), organization.getName(),
					organization.getSlug(), takenDown));
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
					Stream.of(organization.getCreatedByAccountId()),
					Stream.ofNullable(organization.getMergedByAccountId()))
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
					.toList(),
				merged(organization, people));
	}

	/** Where a merged organization went, when and by whom; null for one that was not merged. */
	private @Nullable MergedOrganizationResponse merged(Organization organization, Map<UUID, Person> people) {
		UUID intoId = organization.getMergedIntoId();
		Instant mergedAt = organization.getMergedAt();
		UUID mergedBy = organization.getMergedByAccountId();
		if (intoId == null || mergedAt == null || mergedBy == null) {
			return null;
		}
		Organization into = organizations.findById(intoId).orElseThrow();
		Person operator = people.get(mergedBy);
		return new MergedOrganizationResponse(intoId, into.getSlug(), into.getName(), mergedAt,
				operator == null ? "" : operator.label());
	}

	/**
	 * A domain the operator only has to confirm: the one the organization has, else its creator's work domain while
	 * it waits for review, else its website's. None for an individual, or when another organization holds it.
	 */
	private @Nullable String suggestedDomain(Organization organization, @Nullable Person creator) {
		if (organization.getEmailDomain() != null) {
			return organization.getEmailDomain();
		}
		if (organization.isIndividual()) {
			// A person on their own stands for nobody else at their address.
			return null;
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
		return new AdminOrganizationSummaryResponse(row.id(), row.slug(), row.name(), row.logoFileId(), row.type(),
				row.country(), row.status(), row.suspendedAt(), row.members(), row.owned(), request, row.claimId(),
				asker == null ? null : asker.label(), row.claimedAt() != null ? row.claimedAt()
						: request == null ? null : row.createdAt(),
				row.createdAt(), row.mergedIntoName());
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

	/**
	 * The organizations waiting for an operator's review, at most this many, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public OrganizationsAwaitingReview awaitingReview(Actor actor, int limit) {
		identity.requireOperator(actor);
		return new OrganizationsAwaitingReview(organizationList.adminCount(null, "in_review", null),
				organizationList.adminPage(null, "in_review", null, null, limit, 0)
					.stream()
					.map(row -> new OrganizationsAwaitingReview.Item(row.id(), row.name(), row.type(), row.country(),
							row.createdAt()))
					.toList());
	}

	/**
	 * One page of the operators' list of organizations, in its own order, for the MCP server.
	 * @param status one of the list's statuses, or null for every one
	 * @param q only organizations whose name or domain contains it; every one when null
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public OrganizationReviewList reviewList(Actor actor, @Nullable String status, @Nullable String q, int page,
			int size) {
		AdminOrganizationListResponse found = list(actor,
				new AdminOrganizationListRequest(q, status, null, null, page, size));
		return new OrganizationReviewList(found.total(), found.items()
			.stream()
			.map(item -> new OrganizationReviewList.Item(item.id(), item.name(), item.type(), item.country(),
					item.status(), item.suspendedAt(), item.members(), item.owned(), item.request(), item.askedBy(),
					item.requestedAt(), item.createdAt(), item.mergedInto()))
			.toList());
	}

	/**
	 * One organization as its admin page shows it, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws OrganizationException when the organization does not exist
	 */
	@Transactional(readOnly = true)
	public OrganizationReviewRecord reviewRecord(Actor actor, UUID id) {
		AdminOrganizationResponse found = get(actor, id);
		OrganizationResponse organization = found.organization();
		MergedOrganizationResponse merged = found.merged();
		return new OrganizationReviewRecord(organization.id(), organization.slug(), organization.name(),
				organization.type(), organization.website(), organization.country(), organization.teamSize(),
				organization.industries(), organization.description(), organization.foundedYear(),
				organization.teamBackground(), organization.emailDomain(), organization.status(),
				organization.decisionReason(), organization.decisionMessage(), organization.suspensionReason(),
				organization.suspensionMessage(), organization.suspendedAt(), organization.createdAt(),
				found.createdBy(), found.createdByEmail(),
				found.members()
					.stream()
					.map(member -> new OrganizationReviewRecord.Member(member.name(), member.email(), member.role(),
							member.jobTitle(), member.joinedAt()))
					.toList(),
				found.invitations()
					.stream()
					.map(invitation -> new OrganizationReviewRecord.Invitation(invitation.email(), invitation.role(),
							invitation.invitedBy(), invitation.createdAt(), invitation.expiresAt()))
					.toList(),
				found.claims()
					.stream()
					.map(claim -> new OrganizationReviewRecord.Claim(claim.name(), claim.email(), claim.message(),
							claim.createdAt()))
					.toList(),
				merged == null ? null
						: new OrganizationReviewRecord.Merged(merged.intoId(), merged.intoName(), merged.mergedAt(),
								merged.mergedBy()));
	}

	/**
	 * How many organizations wait for review now, since when the oldest has waited, and how many
	 * waited at the end of each of the last 14 days, for the admin home.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public OrganizationReviewQueueResponse queue(Actor actor) {
		identity.requireOperator(actor);
		LocalDate today = LocalDate.now(QUEUE_ZONE);
		List<Long> days = organizationList.organizationsWaitingByDay(today);
		return new OrganizationReviewQueueResponse(days.getLast(), organizationList.organizationsOldestWaiting(),
				today.minusDays(days.size() - 1L), days);
	}

}
