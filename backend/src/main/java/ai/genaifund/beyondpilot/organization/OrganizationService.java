package ai.genaifund.beyondpilot.organization;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.dto.CreateOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.InvitationResponse;
import ai.genaifund.beyondpilot.organization.dto.InviteMemberRequest;
import ai.genaifund.beyondpilot.organization.dto.JoinOutcomeResponse;
import ai.genaifund.beyondpilot.organization.dto.JoinRequestResponse;
import ai.genaifund.beyondpilot.organization.dto.MembersResponse;
import ai.genaifund.beyondpilot.organization.dto.MyOrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationMatchResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationSearchResponse;
import ai.genaifund.beyondpilot.organization.dto.SaveOrganizationRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Invitation;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.JoinRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Member;
import ai.genaifund.beyondpilot.organization.persistence.Organization;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository.Match;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a person does about their organization: getting into one, and, once inside, what its members and its owners
 * manage. A person belongs to one organization at a time. Every operation reads who the caller is and what they are in
 * the organization now, never from the session.
 */
@Service
public class OrganizationService {

	private static final Logger LOG = LoggerFactory.getLogger(OrganizationService.class);

	private static final String ORGANIZATION = "organization";

	private static final int SEARCH_LIMIT = 10;

	private static final int MIN_SEARCH_LENGTH = 2;

	private final OrganizationRepository organizations;

	private final OrganizationQueryRepository organizationList;

	private final MembershipRepository memberships;

	private final IdentityService identity;

	private final EmailService email;

	private final AuditTrail audit;

	OrganizationService(OrganizationRepository organizations, OrganizationQueryRepository organizationList,
			MembershipRepository memberships, IdentityService identity, EmailService email, AuditTrail audit) {
		this.organizations = organizations;
		this.organizationList = organizationList;
		this.memberships = memberships;
		this.identity = identity;
		this.email = email;
		this.audit = audit;
	}

	/**
	 * Where the caller stands: their organization, or the invitations to their address, the request they wait on and
	 * the organization of their email domain.
	 */
	@Transactional(readOnly = true)
	public MyOrganizationResponse mine(Actor actor) {
		Person person = identity.person(actor);
		List<InvitationResponse> invitations = invitationsTo(person);
		Member member = memberships.memberOf(person.accountId()).orElse(null);
		if (member != null) {
			Organization organization = organizations.findById(member.organizationId()).orElseThrow();
			return new MyOrganizationResponse(OrganizationViews.organization(organization), member.role(),
					member.jobTitle(), invitations, null, null);
		}
		JoinRequestResponse request = memberships.openRequestOf(person.accountId()).map(open -> {
			Organization organization = organizations.findById(open.organizationId()).orElseThrow();
			return OrganizationViews.joinRequest(open, organization.getName(), person,
					memberships.owners(organization.getId()) == 0);
		}).orElse(null);
		String domain = OrganizationViews.workDomain(person.email());
		OrganizationMatchResponse suggestion = domain == null ? null
				: organizations.findByEmailDomain(domain)
					.filter(Organization::isApproved)
					.map(organization -> match(new Match(organization.getId(), organization.getName(),
							organization.getType(), organization.getCountry(), organization.getEmailDomain(),
							organization.isAutoJoin(), memberships.owners(organization.getId()) > 0), domain))
					.orElse(null);
		return new MyOrganizationResponse(null, null, null, invitations, request, suggestion);
	}

	/** The approved organizations whose name contains the text, with what asking to get in does for the caller. */
	@Transactional(readOnly = true)
	public OrganizationSearchResponse search(Actor actor, @Nullable String q) {
		Person person = identity.person(actor);
		String text = OrganizationViews.text(q);
		if (text == null || text.length() < MIN_SEARCH_LENGTH) {
			return new OrganizationSearchResponse(List.of());
		}
		String domain = OrganizationViews.workDomain(person.email());
		return new OrganizationSearchResponse(
				organizationList.search(text, SEARCH_LIMIT).stream().map(found -> match(found, domain)).toList());
	}

	/**
	 * Creates an organization the caller owns. It waits for GenAI Fund's review; until then it lists nothing.
	 * @throws OrganizationException when the caller already belongs to an organization or waits on a request
	 */
	@Transactional
	public OrganizationResponse create(Actor actor, CreateOrganizationRequest request) {
		Person person = identity.person(actor);
		requireFree(person);
		Organization organization = new Organization(UUID.randomUUID(), freeSlug(request.name()),
				request.name().strip(), OrganizationViews.roles(request.roles()), request.type(), Organization.PENDING,
				person.accountId());
		organization.describe(request.name().strip(), OrganizationViews.roles(request.roles()), request.type(),
				OrganizationViews.text(request.website()), request.country(), request.teamSize(),
				OrganizationViews.text(request.description()));
		// A work address vouches for its domain, unless an organization already holds it.
		String domain = OrganizationViews.workDomain(person.email());
		if (domain != null && organizations.findByEmailDomain(domain).isEmpty()) {
			organization.verifyDomain(domain);
		}
		organizations.saveAndFlush(organization);
		if (!memberships.add(organization.getId(), person.accountId(), MembershipRepository.OWNER)) {
			throw alreadyMember(person);
		}
		LOG.atInfo()
			.addKeyValue("event", "organization.creation.submitted")
			.addKeyValue("organization_id", organization.getId())
			.addKeyValue("account_id", person.accountId())
			.log("Organization created, waiting for review");
		return OrganizationViews.organization(organization);
	}

	/**
	 * Asks to get into an approved organization. An address on its domain joins at once while its owners allow it,
	 * and owns it when nobody does; anyone else asks its owners, or GenAI Fund when nobody owns it.
	 * @throws OrganizationException when the organization does not exist or is not approved, or the caller already
	 * belongs to one or waits on a request
	 */
	@Transactional
	public JoinOutcomeResponse join(Actor actor, UUID organizationId, @Nullable String message) {
		Person person = identity.person(actor);
		requireFree(person);
		Organization organization = organizations.findForUpdate(organizationId)
			.filter(Organization::isApproved)
			.orElseThrow(() -> notFound(organizationId));
		boolean owned = memberships.owners(organizationId) > 0;
		String domain = OrganizationViews.workDomain(person.email());
		boolean onDomain = domain != null && domain.equals(organization.getEmailDomain());
		if (onDomain && (!owned || organization.isAutoJoin())) {
			String role = owned ? MembershipRepository.MEMBER : MembershipRepository.OWNER;
			if (!memberships.add(organizationId, person.accountId(), role)) {
				throw alreadyMember(person);
			}
			LOG.atInfo()
				.addKeyValue("event", "organization.member.joined")
				.addKeyValue("organization_id", organizationId)
				.addKeyValue("account_id", person.accountId())
				.addKeyValue("role", role)
				.addKeyValue("way", "domain")
				.log("Joined by email domain");
			return new JoinOutcomeResponse(owned ? "joined" : "owner");
		}
		if (!memberships.request(UUID.randomUUID(), organizationId, person.accountId(),
				OrganizationViews.text(message))) {
			throw requestPending(person);
		}
		return new JoinOutcomeResponse("requested");
	}

	/** Withdraws the request the caller waits on; withdrawing when there is none changes nothing. */
	@Transactional
	public void withdrawRequest(Actor actor) {
		Person person = identity.person(actor);
		memberships.openRequestOf(person.accountId())
			.ifPresent(request -> memberships.closeRequest(request.id(), "withdrawn", null));
	}

	/**
	 * Accepts an invitation to the caller's address, which makes them what it offered.
	 * @throws OrganizationException when no open invitation to the caller has this identifier, or the caller already
	 * belongs to an organization
	 */
	@Transactional
	public void acceptInvitation(Actor actor, UUID invitationId) {
		Person person = identity.person(actor);
		Invitation invitation = invitationTo(person, invitationId);
		Organization organization = organizations.findForUpdate(invitation.organizationId()).orElseThrow();
		boolean firstOwner = memberships.owners(organization.getId()) == 0;
		if (!memberships.add(organization.getId(), person.accountId(), invitation.role())) {
			throw alreadyMember(person);
		}
		if (!memberships.closeInvitation(invitationId, "accepted")) {
			throw invitationNotFound(invitationId);
		}
		// A request made before the invitation arrived has its answer.
		memberships.openRequestOf(person.accountId())
			.ifPresent(request -> memberships.closeRequest(request.id(), "withdrawn", null));
		String domain = OrganizationViews.workDomain(person.email());
		if (firstOwner && organization.getEmailDomain() == null && domain != null
				&& organizations.findByEmailDomain(domain).isEmpty()) {
			organization.verifyDomain(domain);
		}
		LOG.atInfo()
			.addKeyValue("event", "organization.member.joined")
			.addKeyValue("organization_id", organization.getId())
			.addKeyValue("account_id", person.accountId())
			.addKeyValue("role", invitation.role())
			.addKeyValue("way", "invitation")
			.log("Joined by invitation");
	}

	/**
	 * Declines an invitation to the caller's address.
	 * @throws OrganizationException when no open invitation to the caller has this identifier
	 */
	@Transactional
	public void declineInvitation(Actor actor, UUID invitationId) {
		Person person = identity.person(actor);
		invitationTo(person, invitationId);
		memberships.closeInvitation(invitationId, "declined");
	}

	/**
	 * Saves the profile. A refused organization that its owner saves waits for review again.
	 * @throws OrganizationException when the caller is not an owner, or the organization changed since it was read
	 */
	@Transactional
	public OrganizationResponse save(Actor actor, SaveOrganizationRequest request) {
		Member owner = owner(actor);
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		if (organization.getVersion() != request.version()) {
			throw new OrganizationException(OrganizationErrorCode.CHANGED_MEANWHILE,
					"Save of organization " + organization.getId() + " at version " + request.version()
							+ ", which is at " + organization.getVersion());
		}
		organization.describe(request.name().strip(), OrganizationViews.roles(request.roles()), request.type(),
				OrganizationViews.text(request.website()), request.country(), request.teamSize(),
				OrganizationViews.text(request.description()));
		if (organization.isRejected()) {
			organization.resubmit();
		}
		organizations.flush();
		return OrganizationViews.organization(organization);
	}

	/**
	 * Who belongs to the caller's organization. An owner also reads the open invitations and requests.
	 * @throws OrganizationException when the caller belongs to no organization
	 */
	@Transactional(readOnly = true)
	public MembersResponse members(Actor actor) {
		Member caller = member(actor);
		Organization organization = organizations.findById(caller.organizationId()).orElseThrow();
		List<Member> members = memberships.members(organization.getId());
		List<Invitation> invitations = caller.isOwner() ? memberships.openInvitationsOf(organization.getId())
				: List.of();
		List<JoinRequest> requests = caller.isOwner() ? memberships.openRequestsTo(organization.getId()) : List.of();
		Map<UUID, Person> people = identity.people(Stream
			.concat(members.stream().map(Member::accountId),
					OrganizationViews.accounts(invitations, requests).stream())
			.toList());
		return new MembersResponse(OrganizationViews.members(members, people, caller.accountId()),
				invitations.stream()
					.map(invitation -> OrganizationViews.invitation(invitation, organization.getName(), people))
					.toList(),
				requests.stream()
					.filter(request -> people.containsKey(request.accountId()))
					.map(request -> OrganizationViews.joinRequest(request, organization.getName(),
							people.get(request.accountId()), false))
					.toList());
	}

	/**
	 * Asks an address to join the caller's organization and tells it by email.
	 * @throws OrganizationException when the caller is not an owner, the address already belongs to the organization,
	 * or it already holds an open invitation
	 */
	@Transactional
	public void invite(Actor actor, InviteMemberRequest request) {
		Person inviter = identity.person(actor);
		Member owner = owner(actor);
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		String address = request.email().strip();
		List<UUID> accounts = memberships.members(organization.getId()).stream().map(Member::accountId).toList();
		if (identity.people(accounts).values().stream().anyMatch(person -> person.email().equalsIgnoreCase(address))) {
			throw new OrganizationException(OrganizationErrorCode.INVITEE_IS_MEMBER,
					"Invitation of a member of organization " + organization.getId());
		}
		if (!memberships.invite(UUID.randomUUID(), organization.getId(), address, request.role(),
				inviter.accountId())) {
			throw new OrganizationException(OrganizationErrorCode.ALREADY_INVITED,
					"Second open invitation of one address to organization " + organization.getId());
		}
		email.sendOrganizationInvitation(address, organization.getName(), inviter.label(),
				MembershipRepository.OWNER.equals(request.role()));
	}

	/**
	 * Takes back an open invitation of the caller's organization.
	 * @throws OrganizationException when the caller is not an owner, or the invitation is not open
	 */
	@Transactional
	public void revokeInvitation(Actor actor, UUID invitationId) {
		Member owner = owner(actor);
		memberships.openInvitation(invitationId)
			.filter(invitation -> invitation.organizationId().equals(owner.organizationId()))
			.orElseThrow(() -> invitationNotFound(invitationId));
		memberships.closeInvitation(invitationId, "revoked");
	}

	/**
	 * Decides a request to join the caller's organization.
	 * @param approve true makes the person a member; false declines
	 * @throws OrganizationException when the caller is not an owner, the request is not open, or the person joined
	 * another organization in the meantime
	 */
	@Transactional
	public void decideRequest(Actor actor, UUID requestId, boolean approve) {
		Member owner = owner(actor);
		organizations.findForUpdate(owner.organizationId()).orElseThrow();
		JoinRequest request = memberships.openRequest(requestId)
			.filter(open -> open.organizationId().equals(owner.organizationId()))
			.orElseThrow(() -> requestNotFound(requestId));
		if (approve && !memberships.add(owner.organizationId(), request.accountId(), MembershipRepository.MEMBER)) {
			throw new OrganizationException(OrganizationErrorCode.ALREADY_MEMBER,
					"Account " + request.accountId() + " joined another organization before request " + requestId);
		}
		memberships.closeRequest(requestId, approve ? "approved" : "declined", owner.accountId());
	}

	/**
	 * Makes a member an owner, or an owner a member.
	 * @throws OrganizationException when the caller is not an owner, the person does not belong to the organization,
	 * or the change would leave it without an owner
	 */
	@Transactional
	public void changeRole(Actor actor, UUID accountId, String role) {
		Person person = identity.person(actor);
		Member owner = owner(actor);
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		Member target = memberOf(organization, accountId);
		if (target.role().equals(role)) {
			return;
		}
		if (target.isOwner()) {
			requireAnotherOwner(organization);
		}
		memberships.changeRole(organization.getId(), accountId, role);
		record(AuditAction.ORGANIZATION_MEMBER_ROLE, person, organization,
				Map.of("account", accountId.toString(), "role", role));
	}

	/**
	 * Takes a person out of the organization. An owner removes anyone; a member removes only themselves, which is
	 * leaving.
	 * @throws OrganizationException when the caller may not, the person does not belong to the organization, or the
	 * removal would leave it without an owner
	 */
	@Transactional
	public void remove(Actor actor, UUID accountId) {
		Person person = identity.person(actor);
		Member caller = member(actor);
		if (!caller.isOwner() && !caller.accountId().equals(accountId)) {
			throw ownerRequired(caller.accountId());
		}
		Organization organization = organizations.findForUpdate(caller.organizationId()).orElseThrow();
		Member target = memberOf(organization, accountId);
		if (target.isOwner()) {
			requireAnotherOwner(organization);
		}
		memberships.remove(organization.getId(), accountId);
		record(AuditAction.ORGANIZATION_MEMBER_REMOVE, person, organization, Map.of("account", accountId.toString()));
	}

	/**
	 * Sets what the caller does in their organization.
	 * @throws OrganizationException when the caller belongs to no organization
	 */
	@Transactional
	public void changeJobTitle(Actor actor, @Nullable String jobTitle) {
		Member caller = member(actor);
		memberships.changeJobTitle(caller.accountId(), OrganizationViews.text(jobTitle));
	}

	/**
	 * Lets addresses on the organization's domain join without asking, or stops that.
	 * @throws OrganizationException when the caller is not an owner
	 */
	@Transactional
	public void letDomainJoin(Actor actor, boolean autoJoin) {
		Member owner = owner(actor);
		organizations.findForUpdate(owner.organizationId()).orElseThrow().letDomainJoin(autoJoin);
	}

	private List<InvitationResponse> invitationsTo(Person person) {
		List<Invitation> invitations = memberships.openInvitationsTo(person.email());
		if (invitations.isEmpty()) {
			return List.of();
		}
		Map<UUID, Person> people = identity.people(invitations.stream().map(Invitation::invitedByAccountId).toList());
		Map<UUID, OrganizationQueryRepository.Name> names = organizationList
			.names(invitations.stream().map(Invitation::organizationId).distinct().toList())
			.stream()
			.collect(Collectors.toMap(OrganizationQueryRepository.Name::id, name -> name));
		return invitations.stream()
			.filter(invitation -> names.containsKey(invitation.organizationId()))
			.map(invitation -> OrganizationViews.invitation(invitation, names.get(invitation.organizationId()).name(),
					people))
			.toList();
	}

	private Invitation invitationTo(Person person, UUID invitationId) {
		return memberships.openInvitation(invitationId)
			.filter(invitation -> invitation.email().equalsIgnoreCase(person.email()))
			.orElseThrow(() -> invitationNotFound(invitationId));
	}

	private static OrganizationMatchResponse match(Match found, @Nullable String callerDomain) {
		boolean onDomain = callerDomain != null && callerDomain.equals(found.emailDomain());
		String way;
		if (!found.owned()) {
			way = onDomain ? "join" : "claim";
		}
		else {
			way = onDomain && found.autoJoin() ? "join" : "request";
		}
		return new OrganizationMatchResponse(found.id(), found.name(), found.type(), found.country(),
				found.emailDomain(), way);
	}

	/** A person who belongs nowhere and waits on nothing. */
	private void requireFree(Person person) {
		if (memberships.memberOf(person.accountId()).isPresent()) {
			throw alreadyMember(person);
		}
		if (memberships.openRequestOf(person.accountId()).isPresent()) {
			throw requestPending(person);
		}
	}

	private Member member(Actor actor) {
		identity.requireActive(actor);
		return memberships.memberOf(actor.accountId())
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.MEMBERSHIP_REQUIRED,
					"Account " + actor.accountId() + " belongs to no organization"));
	}

	private Member owner(Actor actor) {
		Member member = member(actor);
		if (!member.isOwner()) {
			throw ownerRequired(member.accountId());
		}
		return member;
	}

	private Member memberOf(Organization organization, UUID accountId) {
		return memberships.memberOf(accountId)
			.filter(member -> member.organizationId().equals(organization.getId()))
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.MEMBER_NOT_FOUND,
					"Account " + accountId + " is not in organization " + organization.getId()));
	}

	private void requireAnotherOwner(Organization organization) {
		if (memberships.owners(organization.getId()) < 2) {
			throw new OrganizationException(OrganizationErrorCode.LAST_OWNER,
					"Organization " + organization.getId() + " would lose its last owner");
		}
	}

	/** The address of the name, with a number after it when another organization took it. */
	private String freeSlug(String name) {
		String base = OrganizationViews.slug(name);
		String slug = base;
		for (int suffix = 2; organizations.existsBySlug(slug); suffix++) {
			slug = base + "-" + suffix;
		}
		return slug;
	}

	private void record(AuditAction action, Person person, Organization organization, Map<String, String> details) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(ORGANIZATION, organization.getId().toString(), organization.getName()),
				details));
	}

	private static OrganizationException notFound(UUID organizationId) {
		return new OrganizationException(OrganizationErrorCode.ORGANIZATION_NOT_FOUND,
				"No approved organization " + organizationId);
	}

	private static OrganizationException alreadyMember(Person person) {
		return new OrganizationException(OrganizationErrorCode.ALREADY_MEMBER,
				"Account " + person.accountId() + " already belongs to an organization");
	}

	private static OrganizationException requestPending(Person person) {
		return new OrganizationException(OrganizationErrorCode.REQUEST_PENDING,
				"Account " + person.accountId() + " already waits on a request");
	}

	private static OrganizationException ownerRequired(UUID accountId) {
		return new OrganizationException(OrganizationErrorCode.OWNER_REQUIRED,
				"Owner action by account " + accountId);
	}

	private static OrganizationException invitationNotFound(UUID invitationId) {
		return new OrganizationException(OrganizationErrorCode.INVITATION_NOT_FOUND,
				"No open invitation " + invitationId + " for this caller");
	}

	private static OrganizationException requestNotFound(UUID requestId) {
		return new OrganizationException(OrganizationErrorCode.REQUEST_NOT_FOUND,
				"No open request " + requestId + " for this caller");
	}
}
