package ai.genaifund.beyondpilot.introduction;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.introduction.dto.IntroductionResponse;
import ai.genaifund.beyondpilot.introduction.dto.ReceivedIntroductionsResponse;
import ai.genaifund.beyondpilot.introduction.dto.RequestIntroductionRequest;
import ai.genaifund.beyondpilot.introduction.persistence.IntroductionRepository;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.solution.ApprovedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a person does to be introduced to the organization behind a solution, and what its owners do about it. The
 * provider's owners learn who asks, and by which organization, before they answer; the two addresses are shared only
 * by the answer.
 */
@Service
public class IntroductionService {

	private static final Logger LOG = LoggerFactory.getLogger(IntroductionService.class);

	private static final String INTRODUCTION = "introduction";

	/** How many requests the list of an organization holds. */
	private static final int RECEIVED_SHOWN = 100;

	private final IntroductionRepository requests;

	private final SolutionDirectory solutions;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final EmailService email;

	private final AuditTrail audit;

	IntroductionService(IntroductionRepository requests, SolutionDirectory solutions,
			OrganizationDirectory organizations, IdentityService identity, EmailService email, AuditTrail audit) {
		this.requests = requests;
		this.solutions = solutions;
		this.organizations = organizations;
		this.identity = identity;
		this.email = email;
		this.audit = audit;
	}

	/**
	 * Asks for an introduction to the organization behind an approved solution. Its owners get an email with the sender's
	 * name, organization and message, and no address.
	 * @throws IntroductionException when no approved solution has the address, the caller belongs to no approved
	 * organization or to the one that offers the solution, they already wait for an answer about it, or no owner of the
	 * provider can be reached
	 */
	@Transactional
	public void request(Actor actor, RequestIntroductionRequest request) {
		Membership sender = organizations.membershipOf(actor)
			.orElseThrow(() -> new IntroductionException(IntroductionErrorCode.NEEDS_ORGANIZATION,
					"An introduction asked by a person without an organization"));
		if (!sender.approved()) {
			throw new IntroductionException(IntroductionErrorCode.ORGANIZATION_NOT_APPROVED,
					"An introduction asked by the unapproved organization " + sender.organizationId());
		}
		ApprovedSolution solution = solutions.approvedAt(request.solutionSlug())
			.orElseThrow(() -> new IntroductionException(IntroductionErrorCode.SOLUTION_NOT_FOUND,
					"No approved solution at " + request.solutionSlug()));
		if (solution.organizationId().equals(sender.organizationId())) {
			throw new IntroductionException(IntroductionErrorCode.OWN_SOLUTION,
					"An introduction to the sender's own organization");
		}
		Map<UUID, Person> owners = identity.people(organizations.ownersOf(solution.organizationId()));
		if (owners.isEmpty()) {
			throw new IntroductionException(IntroductionErrorCode.UNREACHABLE,
					"No owner of organization " + solution.organizationId() + " can be reached");
		}
		String message = request.message().strip();
		if (requests.pendingFrom(actor.accountId(), solution.id()) || !requests.add(solution.id(), solution.name(),
				solution.organizationId(), actor.accountId(), sender.organizationId(), message)) {
			throw new IntroductionException(IntroductionErrorCode.ALREADY_PENDING,
					"A second waiting introduction to solution " + solution.id());
		}
		Person person = identity.person(actor);
		for (Person owner : owners.values()) {
			email.sendIntroductionRequest(owner.email(), person.displayName(), sender.organizationName(),
					solution.name(), message);
		}
		LOG.atInfo()
			.addKeyValue("event", "introduction.requested")
			.addKeyValue("solution_id", solution.id())
			.log("Introduction requested");
	}

	/**
	 * The requests to the caller's organization, newest first. A member reads them; an owner also answers them. The
	 * sender's address appears only on a request that was replied to.
	 * @throws IntroductionException when the caller belongs to no organization
	 */
	@Transactional(readOnly = true)
	public ReceivedIntroductionsResponse received(Actor actor) {
		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> new IntroductionException(IntroductionErrorCode.NEEDS_ORGANIZATION,
					"Introductions read by a person without an organization"));
		List<IntroductionRepository.Request> rows = requests.receivedBy(membership.organizationId(), RECEIVED_SHOWN);
		Map<UUID, Person> people = identity
			.people(rows.stream().map(IntroductionRepository.Request::senderAccountId).distinct().toList());
		Map<UUID, OrganizationName> senderOrganizations = organizations.names(
				rows.stream().map(IntroductionRepository.Request::senderOrganizationId).distinct().toList());
		return new ReceivedIntroductionsResponse(rows.stream().map(row -> {
			Person sender = people.get(row.senderAccountId());
			OrganizationName organization = senderOrganizations.get(row.senderOrganizationId());
			boolean replied = IntroductionRepository.REPLIED.equals(row.status());
			return new IntroductionResponse(row.id(), row.solutionName(),
					organization == null ? "" : organization.name(), sender == null ? null : sender.displayName(),
					replied && sender != null ? sender.email() : null, row.message(), row.status(), row.createdAt(),
					row.answeredAt());
		}).toList(), membership.owner());
	}

	/**
	 * Accepts a request: the sender and the owner who answers are each told the other's name and address.
	 * @throws IntroductionException when the caller is not an owner of the organization asked, the request is not
	 * theirs to answer, was answered already, or the sender no longer signs in
	 */
	@Transactional
	public void reply(Actor actor, UUID id) {
		Membership owner = owner(actor);
		IntroductionRepository.Request request = waiting(owner, id);
		Person sender = identity.people(List.of(request.senderAccountId())).get(request.senderAccountId());
		if (sender == null) {
			// The account that asked no longer signs in, so nobody would read the introduction.
			throw notFound(id);
		}
		Person answering = identity.person(actor);
		OrganizationName senderOrganization = organizations.names(List.of(request.senderOrganizationId()))
			.get(request.senderOrganizationId());
		String senderOrganizationName = senderOrganization == null ? "" : senderOrganization.name();
		requests.answer(id, IntroductionRepository.REPLIED, actor.accountId());
		email.sendIntroduction(sender.email(), answering.displayName(), answering.email(), owner.organizationName(),
				request.solutionName());
		email.sendIntroduction(answering.email(), sender.displayName(), sender.email(), senderOrganizationName,
				request.solutionName());
		record(AuditAction.INTRODUCTION_REPLY, answering, actor, request);
	}

	/**
	 * Declines a request. The sender is told that the provider will not take it further, without an address.
	 * @throws IntroductionException when the caller is not an owner of the organization asked, the request is not
	 * theirs to answer, or was answered already
	 */
	@Transactional
	public void decline(Actor actor, UUID id) {
		Membership owner = owner(actor);
		IntroductionRepository.Request request = waiting(owner, id);
		Person sender = identity.people(List.of(request.senderAccountId())).get(request.senderAccountId());
		requests.answer(id, IntroductionRepository.DECLINED, actor.accountId());
		if (sender != null) {
			email.sendIntroductionDeclined(sender.email(), owner.organizationName(), request.solutionName());
		}
		record(AuditAction.INTRODUCTION_DECLINE, identity.person(actor), actor, request);
	}

	private Membership owner(Actor actor) {
		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> new IntroductionException(IntroductionErrorCode.NEEDS_ORGANIZATION,
					"An introduction answered by a person without an organization"));
		if (!membership.owner()) {
			throw new IntroductionException(IntroductionErrorCode.OWNERS_ONLY,
					"An introduction answered by a member who is not an owner");
		}
		return membership;
	}

	/** The request to the owner's organization that still waits; another organization's answers the same as none. */
	private IntroductionRepository.Request waiting(Membership owner, UUID id) {
		IntroductionRepository.Request request = requests.findForUpdate(id)
			.filter(found -> found.providerOrganizationId().equals(owner.organizationId()))
			.orElseThrow(() -> notFound(id));
		if (!IntroductionRepository.PENDING.equals(request.status())) {
			throw new IntroductionException(IntroductionErrorCode.NOT_PENDING,
					"Introduction " + id + " was answered already");
		}
		return request;
	}

	private void record(AuditAction action, Person person, Actor actor, IntroductionRepository.Request request) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(actor.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(INTRODUCTION, request.id().toString(), request.solutionName()), Map.of()));
	}

	private static IntroductionException notFound(UUID id) {
		return new IntroductionException(IntroductionErrorCode.REQUEST_NOT_FOUND, "No introduction request " + id);
	}
}
