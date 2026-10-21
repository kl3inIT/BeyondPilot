package ai.genaifund.beyondpilot.organization;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
import ai.genaifund.beyondpilot.organization.dto.DeclinedRequestResponse;
import ai.genaifund.beyondpilot.organization.dto.InvitationAllowanceResponse;
import ai.genaifund.beyondpilot.organization.dto.InvitationResponse;
import ai.genaifund.beyondpilot.organization.dto.InviteMemberRequest;
import ai.genaifund.beyondpilot.organization.dto.JoinOutcomeResponse;
import ai.genaifund.beyondpilot.organization.dto.JoinRequestResponse;
import ai.genaifund.beyondpilot.organization.dto.MemberListRequest;
import ai.genaifund.beyondpilot.organization.dto.MergeNoticeResponse;
import ai.genaifund.beyondpilot.organization.dto.MembersResponse;
import ai.genaifund.beyondpilot.organization.dto.MyOrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationMatchResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationSearchResponse;
import ai.genaifund.beyondpilot.organization.dto.SaveOrganizationBasicsRequest;
import ai.genaifund.beyondpilot.organization.dto.SaveOrganizationRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.ClosedRequest;
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
import org.springframework.context.ApplicationEventPublisher;
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

	private static final int MEMBERS_PAGE_SIZE = 10;

	private static final int MIN_SEARCH_LENGTH = 2;

	/** The most invitations an organization's owners send in 24 hours. */
	private static final int DAILY_INVITATIONS = 20;

	/** The most invitations of an organization's owners that wait for an answer at once. */
	private static final int OPEN_INVITATIONS = 50;

	/** How long an invitation waits for its answer before it lapses. */
	static final Duration INVITATION_LIFETIME = Duration.ofDays(7);

	private final OrganizationRepository organizations;

	private final OrganizationQueryRepository organizationList;

	private final MembershipRepository memberships;

	private final IdentityService identity;

	private final EmailService email;

	private final AuditTrail audit;

	private final OrganizationLogos logos;

	private final ApplicationEventPublisher events;

	OrganizationService(OrganizationRepository organizations, OrganizationQueryRepository organizationList,
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
	 * Where the caller stands: their organization, or the invitations to their address, the request they wait on or
	 * the refusal of their last one, and the organization of their email domain.
	 */
	@Transactional(readOnly = true)
	public MyOrganizationResponse mine(Actor actor) {
		Person person = identity.person(actor);
		List<InvitationResponse> invitations = invitationsTo(person);
		Member member = memberships.memberOf(person.accountId()).orElse(null);
		if (member != null) {
			Organization organization = organizations.findById(member.organizationId()).orElseThrow();
			MergeNoticeResponse mergedFrom = memberships.mergedFromOf(person.accountId())
				.flatMap(organizations::findById)
				.flatMap(merged -> Optional.ofNullable(merged.getMergedAt())
					.map(at -> new MergeNoticeResponse(merged.getName(), merged.getSlug(), at)))
				.orElse(null);
			return new MyOrganizationResponse(OrganizationViews.organization(organization), member.role(),
					member.jobTitle(), invitations, null, null, null, mergedFrom);
		}
		JoinRequestResponse request = memberships.openRequestOf(person.accountId())
			.map(open -> OrganizationViews.joinRequest(open,
					organizations.findById(open.organizationId()).orElseThrow(), person))
			.orElse(null);
		DeclinedRequestResponse declined = request != null ? null
				: memberships.latestClosedRequestOf(person.accountId())
					.filter(ClosedRequest::isDeclined)
					.map(closed -> OrganizationViews.declined(closed,
							organizations.findById(closed.organizationId()).orElseThrow()))
					.orElse(null);
		String domain = OrganizationViews.workDomain(person.email());
		OrganizationMatchResponse suggestion = domain == null ? null
				: organizations.findByEmailDomain(domain)
					.filter(Organization::isActive)
					.map(organization -> match(new Match(organization.getId(), organization.getName(),
							organization.getType(), organization.getCountry(), organization.getEmailDomain(),
							organization.getLogoFileId(), organization.isAutoJoin(), memberships.owners(organization.getId()) > 0), domain))
					.orElse(null);
		return new MyOrganizationResponse(null, null, null, invitations, request, declined, suggestion, null);
	}

	/** The organizations, not taken down, whose name contains the text, with what asking to get in does for the caller. */
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
	 * Creates an organization the caller owns. It is active at once. It has no email domain: only an operator verifies
	 * one.
	 * @throws OrganizationException when the caller already belongs to an organization or waits on a request
	 */
	@Transactional
	public OrganizationResponse create(Actor actor, CreateOrganizationRequest request) {
		return createOwned(actor, new Profile.Builder(request.name(), request.type(), request.country(),
                request.teamSize(), request.industries()).website(request.website()).description(request.description())
                .foundedYear(request.foundedYear()).logoFileId(request.logoFileId())
                .teamBackground(request.teamBackground()).build(), request.jobTitle());
	}

	/**
	 * Creates an organization the caller owns from its type's required facts. It is active at once. Review decides
	 * what an organization lists, not whether it exists or sends a proposal.
	 * @throws OrganizationException when the caller already belongs to an organization or waits on a request, or a
	 * company names no industry
	 */
	@Transactional
	public OrganizationResponse createFromBasics(Actor actor, SaveOrganizationBasicsRequest request) {
		boolean company = "company".equals(request.type());
		boolean alone = "independent_builder".equals(request.type());
		return createOwned(actor, new Profile.Builder(request.name().strip(), request.type(), request.country(),
				alone ? "just_me" : request.teamSize(), company ? request.industries() : List.of())
				.website(company ? request.website() : null)
				.foundedYear(company ? request.foundedYear() : null)
				.description(alone ? null : request.description()).build(), null);
	}

	/**
	 * Makes the organization a person applies through when they belong to none (BEY-37): a builder on their own or a
	 * team, which provides AI solutions. It is active at once, and a builder on their own is named as given, after the
	 * person.
	 * @return the new organization's identifier
	 * @throws OrganizationException when the caller already belongs to an organization or waits on a request
	 */
	@Transactional
	public UUID createForApplicant(Actor actor, ApplicantOrganization applicant) {
		if (!"independent_builder".equals(applicant.type()) && !"builder_team".equals(applicant.type())) {
			throw new IllegalArgumentException("An applicant makes a builder's or a team's organization, not "
					+ applicant.type());
		}
		return createOwned(actor, new Profile.Builder(applicant.name(), applicant.type(), applicant.country(),
                applicant.teamSize(), List.of()).website(applicant.website()).build(), null)
			.id();
	}

	/** What an organization's creator tells about it; a team or a builder applying may leave the rest for later. */
	private record Profile(String name, String type, @Nullable String website, String country, String teamSize,
			List<String> industries, @Nullable String description, @Nullable Integer foundedYear,
			@Nullable UUID logoFileId, @Nullable String teamBackground) {
        static final class Builder {
            private final String name;
            private final String type;
            private final String country;
            private final String teamSize;
            private final List<String> industries;
            private @Nullable String website;
            private @Nullable String description;
            private @Nullable Integer foundedYear;
            private @Nullable UUID logoFileId;
            private @Nullable String teamBackground;
            Builder(String name, String type, String country, String teamSize, List<String> industries) {
                this.name = name;
                this.type = type;
                this.country = country;
                this.teamSize = teamSize;
                this.industries = industries;
            }
            Builder website(@Nullable String value) { website = value; return this; }
            Builder description(@Nullable String value) { description = value; return this; }
            Builder foundedYear(@Nullable Integer value) { foundedYear = value; return this; }
            Builder logoFileId(@Nullable UUID value) { logoFileId = value; return this; }
            Builder teamBackground(@Nullable String value) { teamBackground = value; return this; }
            Profile build() {
                return new Profile(name, type, website, country, teamSize, industries, description, foundedYear, logoFileId, teamBackground);
            }
        }
    }

	private OrganizationResponse createOwned(Actor actor, Profile profile, @Nullable String creatorJobTitle) {
		Person person = identity.person(actor);
		requireFree(person);
		// Every organization is active at once. What it lists is reviewed.
		boolean individual = Organization.INDIVIDUAL.equals(profile.type());
		String name = profile.name().strip();
		if ("company".equals(profile.type()) && profile.industries().isEmpty()) {
			// A team or a builder on their own may not have settled on an industry; a company has.
			throw new OrganizationException(OrganizationErrorCode.INDUSTRIES_REQUIRED,
					"Company created by account " + person.accountId() + " without an industry");
		}
		if (profile.logoFileId() != null) {
			logos.requireUsable(actor, profile.logoFileId());
		}
		Organization organization = new Organization(UUID.randomUUID(), freeSlug(name), name, profile.type(),
				person.accountId());
		organization.describe(name, profile.type(), OrganizationViews.text(profile.website()),
				profile.country(), profile.teamSize(), OrganizationViews.codes(profile.industries()),
				OrganizationViews.text(profile.description()), profile.foundedYear(), profile.logoFileId());
		organization.describeTeam(OrganizationViews.text(profile.teamBackground()));
		organizations.saveAndFlush(organization);
		if (!memberships.add(organization.getId(), person.accountId(), MembershipRepository.OWNER)) {
			throw alreadyMember(person);
		}
		String jobTitle = OrganizationViews.text(creatorJobTitle);
		if (jobTitle != null) {
			memberships.changeJobTitle(person.accountId(), jobTitle);
		}
		LOG.atInfo()
			.addKeyValue("event", individual ? "organization.individual.created" : "organization.created")
			.addKeyValue("organization_id", organization.getId())
			.addKeyValue("account_id", person.accountId())
			.log(individual ? "Individual created" : "Organization created");
		return OrganizationViews.organization(organization);
	}

	/**
	 * Asks to get into an organization that is not taken down. An address on its verified domain joins at once while its owners
	 * allow it; anyone else asks its owners. An organization nobody owns is claimed, and GenAI Fund decides the claim
	 * whatever the address.
	 * @throws OrganizationException when the organization does not exist or is not active, or the caller already
	 * belongs to one or waits on a request
	 */
	@Transactional
	public JoinOutcomeResponse join(Actor actor, UUID organizationId, @Nullable String message) {
		Person person = identity.person(actor);
		requireFree(person);
		Organization organization = organizations.findForUpdate(organizationId)
			.filter(Organization::isActive)
			.filter(found -> !found.isIndividual())
			.orElseThrow(() -> notFound(organizationId));
		boolean owned = memberships.owners(organizationId) > 0;
		String domain = OrganizationViews.workDomain(person.email());
		boolean onDomain = domain != null && domain.equals(organization.getEmailDomain());
		if (owned && onDomain && organization.isAutoJoin()) {
			if (!memberships.add(organizationId, person.accountId(), MembershipRepository.MEMBER)) {
				throw alreadyMember(person);
			}
			LOG.atInfo()
				.addKeyValue("event", "organization.member.joined")
				.addKeyValue("organization_id", organizationId)
				.addKeyValue("account_id", person.accountId())
				.addKeyValue("role", MembershipRepository.MEMBER)
				.addKeyValue("way", "domain")
				.log("Joined by email domain");
			return new JoinOutcomeResponse("joined");
		}
		if (!memberships.request(UUID.randomUUID(), organizationId, person.accountId(),
				OrganizationViews.text(message), !owned)) {
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
		boolean firstOwner = MembershipRepository.OWNER.equals(invitation.role())
				&& memberships.owners(organization.getId()) == 0;
		if (!memberships.add(organization.getId(), person.accountId(), invitation.role())) {
			throw alreadyMember(person);
		}
		if (!memberships.closeInvitation(invitationId, "accepted")) {
			throw invitationNotFound(invitationId);
		}
		// A request made before the invitation arrived has its answer.
		memberships.openRequestOf(person.accountId())
			.ifPresent(request -> memberships.closeRequest(request.id(), "withdrawn", null));
		if (firstOwner) {
			memberships.claimsBecomeRequests(organization.getId());
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
	 * Saves the profile.
	 * @throws OrganizationException when the caller is not an owner, or the organization changed since it was read
	 */
	@Transactional
    public OrganizationResponse save(Actor actor, SaveOrganizationRequest request) {
        Member owner = owner(actor);
        if ("company".equals(request.type()) && request.industries().isEmpty()) {
            throw new OrganizationException(OrganizationErrorCode.INDUSTRIES_REQUIRED,
                    "Company profile saved without an industry");
        }
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		requireTypeChange(organization, request.type(), request.teamSize());
		if (organization.getVersion() != request.version()) {
			throw new OrganizationException(OrganizationErrorCode.CHANGED_MEANWHILE,
					"Save of organization " + organization.getId() + " at version " + request.version()
							+ ", which is at " + organization.getVersion());
		}
		UUID formerLogo = organization.getLogoFileId();
		UUID logo = request.logoFileId();
		if (logo != null && !logo.equals(formerLogo)) {
			logos.requireUsable(actor, logo);
		}
		String formerType = organization.getType();
		boolean aloneNow = Organization.INDIVIDUAL.equals(request.type());
		organization.describe(request.name().strip(), request.type(),
				OrganizationViews.text(request.website()), request.country(), aloneNow ? "just_me" : request.teamSize(),
				OrganizationViews.codes(request.industries()), OrganizationViews.text(request.description()),
				request.foundedYear(), logo);
		organization.describeTeam(OrganizationViews.text(request.teamBackground()));
		organization.settleTypeChange(formerType);
		organizations.flush();
		events.publishEvent(new OrganizationChanged(organization.getId()));
		logos.discardReplaced(formerLogo, logo);
		return OrganizationViews.organization(organization);
	}

	/**
	 * Saves the selected type's required facts, preserving optional facts the popup cannot edit.
	 * @throws OrganizationException when the caller is not an owner, or a company names no industry
	 */
	@Transactional
	public OrganizationResponse saveBasics(Actor actor, SaveOrganizationBasicsRequest request) {
		Member owner = owner(actor);
		if ("company".equals(request.type()) && request.industries().isEmpty()) {
			throw new OrganizationException(OrganizationErrorCode.INDUSTRIES_REQUIRED,
					"Company saved by account " + actor.accountId() + " without an industry");
		}
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		requireTypeChange(organization, request.type(), request.teamSize());
		if (request.version() == null || organization.getVersion() != request.version()) {
			throw new OrganizationException(OrganizationErrorCode.CHANGED_MEANWHILE,
					"Stale basics save of organization " + organization.getId());
		}
		boolean company = "company".equals(request.type());
		boolean alone = "independent_builder".equals(request.type());
		String formerType = organization.getType();
		organization.describe(request.name().strip(), request.type(),
				company ? OrganizationViews.text(request.website()) : organization.getWebsite(),
				request.country(), alone ? "just_me" : request.teamSize(),
				company ? OrganizationViews.codes(request.industries()) : organization.getIndustries(),
				alone ? organization.getDescription() : OrganizationViews.text(request.description()),
				company ? request.foundedYear() : organization.getFoundedYear(), organization.getLogoFileId());
		organization.settleTypeChange(formerType);
		organizations.flush();
		events.publishEvent(new OrganizationChanged(organization.getId()));
		return OrganizationViews.organization(organization);
	}

	/**
	 * Who belongs to the caller's organization, in the order the request asks for. An owner also reads the open invitations and requests, and how many
	 * more people they may invite.
	 * @throws OrganizationException when the caller belongs to no organization
	 */
	@Transactional(readOnly = true)
	public MembersResponse members(Actor actor, MemberListRequest list) {
		Member caller = member(actor);
		Organization organization = organizations.findById(caller.organizationId()).orElseThrow();
		int page = list.page() == null ? 1 : list.page();
		int size = list.size() == null ? MEMBERS_PAGE_SIZE : list.size();
		List<Member> members = memberships.members(organization.getId(), list.sort(), size,
				(long) (page - 1) * size);
		List<Invitation> invitations = caller.isOwner() ? memberships.openInvitationsOf(organization.getId())
				: List.of();
		List<JoinRequest> requests = caller.isOwner() ? memberships.openRequestsTo(organization.getId()) : List.of();
		Map<UUID, Person> people = identity.people(Stream
			.concat(members.stream().map(Member::accountId),
					OrganizationViews.accounts(invitations, requests).stream())
			.toList());
		return new MembersResponse(OrganizationViews.members(members, people, caller.accountId()), page,
				size, memberships.countMembers(organization.getId()),
				invitations.stream()
					.map(invitation -> OrganizationViews.invitation(invitation, organization.getName(), people))
					.toList(),
				requests.stream()
					.filter(request -> people.containsKey(request.accountId()))
					.map(request -> OrganizationViews.joinRequest(request, organization,
							people.get(request.accountId())))
					.toList(),
				caller.isOwner() ? allowance(organization) : null);
	}

	/**
	 * Asks an address to join the caller's organization and tells it by email. Only an organization that is not taken
	 * down invites, and within its limits: so many in 24 hours, and so many open at once.
	 * @throws OrganizationException when the caller is not an owner, the organization is taken down or reached a
	 * limit, the address already belongs to the organization, or it already holds an open invitation
	 */
	@Transactional
	public void invite(Actor actor, InviteMemberRequest request) {
		Person inviter = identity.person(actor);
		Member owner = owner(actor);
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		if (organization.isIndividual()) {
			throw individual(organization, "invitation");
		}
		if (!organization.isActive()) {
			throw new OrganizationException(OrganizationErrorCode.NOT_APPROVED,
					"Invitation by organization " + organization.getId() + ", which is " + organization.getStatus());
		}
		InvitationAllowanceResponse allowance = allowance(organization);
		if (allowance.leftToday() == 0) {
			throw new OrganizationException(OrganizationErrorCode.INVITATION_DAILY_LIMIT,
					"Organization " + organization.getId() + " sent " + DAILY_INVITATIONS + " invitations in a day");
		}
		if (allowance.leftOpen() == 0) {
			throw new OrganizationException(OrganizationErrorCode.INVITATION_OPEN_LIMIT,
					"Organization " + organization.getId() + " keeps " + OPEN_INVITATIONS + " invitations open");
		}
		String address = request.email().strip();
		List<UUID> accounts = memberships.members(organization.getId()).stream().map(Member::accountId).toList();
		if (identity.people(accounts).values().stream().anyMatch(person -> person.email().equalsIgnoreCase(address))) {
			throw new OrganizationException(OrganizationErrorCode.INVITEE_IS_MEMBER,
					"Invitation of a member of organization " + organization.getId());
		}
		if (!memberships.invite(UUID.randomUUID(), organization.getId(), address, request.role(),
				inviter.accountId(), false, INVITATION_LIFETIME)) {
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
	 * Decides a request to join the caller's organization, and tells the person.
	 * @param approve true makes the person a member; false declines
	 * @throws OrganizationException when the caller is not an owner, the request is not open or was withdrawn in the
	 * meantime, or the person joined another organization in the meantime
	 */
	@Transactional
	public void decideRequest(Actor actor, UUID requestId, boolean approve) {
		Member owner = owner(actor);
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		JoinRequest request = memberships.openRequest(requestId)
			.filter(open -> open.organizationId().equals(owner.organizationId()))
			.orElseThrow(() -> requestNotFound(requestId));
		if (approve && !memberships.add(owner.organizationId(), request.accountId(), MembershipRepository.MEMBER)) {
			throw new OrganizationException(OrganizationErrorCode.ALREADY_MEMBER,
					"Account " + request.accountId() + " joined another organization before request " + requestId);
		}
		if (!memberships.closeRequest(requestId, approve ? "approved" : "declined", owner.accountId())) {
			// Withdrawn since it was read: the person is not added, and nothing is sent.
			throw requestNotFound(requestId);
		}
		Person asker = identity.people(List.of(request.accountId())).get(request.accountId());
		if (asker != null) {
			email.sendOrganizationRequestDecision(asker.email(), organization.getName(), false, approve);
		}
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
	 * leaving. A taken-down organization lets its last owner go: staying would keep the person out of every other
	 * organization.
	 * @throws OrganizationException when the caller may not, the person does not belong to the organization, or the
	 * removal would leave an organization that is not taken down without an owner
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
		if (target.isOwner() && !organization.isSuspended()) {
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

	/** Takes away the notice that the caller's former organization was merged into this one. */
	@Transactional
	public void dismissMergeNotice(Actor actor) {
		memberships.dismissMergeNotice(member(actor).accountId());
	}

	/**
	 * Lets addresses on the organization's verified domain join without asking, or stops that.
	 * @throws OrganizationException when the caller is not an owner, or turns it on for an organization that is not
	 * active or has no verified domain
	 */
	@Transactional
	public void letDomainJoin(Actor actor, boolean autoJoin) {
		Member owner = owner(actor);
		Organization organization = organizations.findForUpdate(owner.organizationId()).orElseThrow();
		if (autoJoin && organization.isIndividual()) {
			throw individual(organization, "joining by domain");
		}
		if (autoJoin && !(organization.isActive() && organization.getEmailDomain() != null)) {
			throw new OrganizationException(OrganizationErrorCode.DOMAIN_NOT_VERIFIED,
					"Joining at once turned on for organization " + organization.getId() + " without a verified domain");
		}
		organization.letDomainJoin(autoJoin);
	}

	/**
	 * Turns the caller's individual into their team, which stays active. Whether it may still change is for the
	 * caller to decide, from what was sent under it.
	 * @return the team's identifier
	 * @throws OrganizationException when the caller does not own an individual
	 */
	@Transactional
	public UUID becomeTeam(Actor actor, ApplicantOrganization team) {
		Organization organization = ownIndividual(actor);
		organization.becomeTeam(team.name().strip(), team.teamSize(), OrganizationViews.text(team.website()));
		organizations.flush();
		events.publishEvent(new OrganizationChanged(organization.getId()));
		LOG.atInfo()
			.addKeyValue("event", "organization.individual.became_team")
			.addKeyValue("organization_id", organization.getId())
			.log("Individual became a team");
		return organization.getId();
	}

	/**
	 * Takes the caller out of their individual so that they can join or add a company. The record stays, with nobody
	 * in it, for what was written under its name; it is shown nowhere.
	 * @throws OrganizationException when the caller does not own an individual
	 */
	@Transactional
	public void leaveIndividual(Actor actor) {
		Organization organization = ownIndividual(actor);
		memberships.remove(organization.getId(), actor.accountId());
		LOG.atInfo()
			.addKeyValue("event", "organization.individual.left")
			.addKeyValue("organization_id", organization.getId())
			.log("Person left their individual");
	}

	private Organization ownIndividual(Actor actor) {
		Member owner = owner(actor);
		return organizations.findForUpdate(owner.organizationId())
			.filter(Organization::isIndividual)
			.orElseThrow(() -> new OrganizationException(OrganizationErrorCode.MEMBERSHIP_REQUIRED,
					"Account " + actor.accountId() + " owns no individual"));
	}

	/**
	 * An organization changes between a person on their own, a team, a company and another kind. One person has no
	 * other member, invitation or request to join; one that becomes a team or a company says how big it is.
	 * @throws OrganizationException when it is to become a person on their own and has others, or it leaves being one
	 * without a team size
	 */
	private void requireTypeChange(Organization organization, String type, @Nullable String teamSize) {
		boolean toIndividual = Organization.INDIVIDUAL.equals(type);
		if (toIndividual && !organization.isIndividual()
				&& (memberships.countMembers(organization.getId()) > 1
						|| !memberships.openInvitationsOf(organization.getId()).isEmpty()
						|| !memberships.openRequestsTo(organization.getId()).isEmpty())) {
			throw new OrganizationException(OrganizationErrorCode.NOT_ALONE,
					"Organization " + organization.getId() + " has others and cannot become an individual");
		}
		if (!toIndividual && organization.isIndividual() && (teamSize == null || "just_me".equals(teamSize))) {
			throw new OrganizationException(OrganizationErrorCode.TEAM_SIZE_REQUIRED,
					"Individual " + organization.getId() + " became " + type + " with team size " + teamSize);
		}
	}

	private static OrganizationException individual(Organization organization, String what) {
		return new OrganizationException(OrganizationErrorCode.INDIVIDUAL,
				"Refused " + what + " for individual " + organization.getId());
	}

	private InvitationAllowanceResponse allowance(Organization organization) {
		int leftToday = Math.max(0, DAILY_INVITATIONS - memberships.invitationsSentInTheLastDay(organization.getId()));
		int leftOpen = Math.max(0, OPEN_INVITATIONS - memberships.openInvitationsByOwners(organization.getId()));
		return new InvitationAllowanceResponse(organization.isActive(), leftToday, DAILY_INVITATIONS, leftOpen,
				OPEN_INVITATIONS);
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
			way = "claim";
		}
		else {
			way = onDomain && found.autoJoin() ? "join" : "request";
		}
		return new OrganizationMatchResponse(found.id(), found.name(), found.type(), found.country(),
				found.emailDomain(), onDomain, found.logoFileId(), way);
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
				"No active organization " + organizationId);
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
