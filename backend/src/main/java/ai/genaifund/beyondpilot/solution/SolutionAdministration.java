package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.RejectCustomerDeploymentRequest;
import ai.genaifund.beyondpilot.solution.dto.RejectSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SendBackSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionBackingRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionResponse;
import ai.genaifund.beyondpilot.solution.dto.TakeDownSolutionRequest;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeployment;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeploymentRepository;
import ai.genaifund.beyondpilot.solution.persistence.Solution;
import ai.genaifund.beyondpilot.solution.persistence.SolutionQueryRepository;
import ai.genaifund.beyondpilot.solution.persistence.SolutionRepository;
import ai.genaifund.beyondpilot.storage.StorageService;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with solutions and their customer deployments: read those that were sent for review, approve one,
 * send one back with what to change, refuse one for good with a reason, and take an approved one down and restore it.
 * Every operation first checks that the caller is an operator now, every decision is recorded in the audit trail in
 * the transaction of the change, and the members of the organization are told of a decision on a solution by email.
 * A draft is its organization's alone and is never shown here.
 */
@Service
public class SolutionAdministration {

	static final int PAGE_SIZE = 25;

	private static final String SOLUTION = "solution";

	private static final String CUSTOMER_DEPLOYMENT = "customer_deployment";

	private final SolutionRepository solutions;

	private final CustomerDeploymentRepository deployments;

	private final SolutionQueryRepository solutionList;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	private final StorageService storage;

	private final EmailService email;

	SolutionAdministration(SolutionRepository solutions, CustomerDeploymentRepository deployments,
			SolutionQueryRepository solutionList, OrganizationDirectory organizations, IdentityService identity,
			AuditTrail audit, ApplicationEventPublisher events, StorageService storage, EmailService email) {
		this.solutions = solutions;
		this.deployments = deployments;
		this.solutionList = solutionList;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
		this.events = events;
		this.storage = storage;
		this.email = email;
	}

	/**
	 * One page of the submitted solutions the request selects: those waiting for review first. The text matches a
	 * solution by its name or by its organization's name.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminSolutionListResponse list(Actor actor, AdminSolutionListRequest request) {
		identity.requireOperator(actor);
		String text = SolutionViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		List<UUID> named = text == null ? List.of() : organizations.named(text);
		List<SolutionQueryRepository.Row> rows = solutionList.adminPage(text, named, request.status(),
				request.industry(), PAGE_SIZE, (long) (page - 1) * PAGE_SIZE);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(SolutionQueryRepository.Row::organizationId).distinct().toList());
		Map<UUID, Person> senders = identity.people(rows.stream()
			.map(SolutionQueryRepository.Row::submittedByAccountId)
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		return new AdminSolutionListResponse(rows.stream()
			.map(row -> SolutionViews.adminSummary(row, name(names, row.organizationId()),
					sender(senders, row.submittedByAccountId())))
			.toList(), page, PAGE_SIZE, solutionList.adminCount(text, named, request.status(), request.industry()),
				solutionList.awaitingReview(), solutionList.deploymentsAwaitingReview());
	}

	/**
	 * One submitted solution as an operator reviews it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when no submitted solution has this identifier
	 */
	@Transactional(readOnly = true)
	public SolutionResponse get(Actor actor, UUID id) {
		identity.requireOperator(actor);
		Solution solution = solutions.findById(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
		return SolutionViews.solution(solution,
				name(organizations.names(List.of(solution.getOrganizationId())), solution.getOrganizationId()),
				SolutionViews.sender(solution, identity), deployments.findBySolutionIdOrderByCreatedAtDesc(id),
				storage);
	}

	/**
	 * Approves a solution that waits for review, which puts it in the public directory unless its owners keep it
	 * unlisted.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist or does not wait for review
	 */
	@Transactional
	public void approve(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = reviewable(id);
		if (!solution.isInReview()) {
			throw notAwaiting(solution);
		}
		if (!organizations.isApproved(solution.getOrganizationId())) {
			// The directory lists a solution only when GenAI Fund has approved who offers it too.
			throw new SolutionException(SolutionErrorCode.ORGANIZATION_NOT_APPROVED,
					"Approval of solution " + id + " whose organization is not approved");
		}
		solution.approve(Instant.now());
		record(AuditAction.SOLUTION_APPROVE, operator, solution, Map.of());
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.APPROVED, null);
	}

	/**
	 * Writes what GenAI Fund says of a solution beside its owners' words: who backs its company, the programme it was
	 * selected for and its funding. Its page shows them marked as GenAI Fund's, so only an operator writes them, on
	 * a solution that was sent for review.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when no submitted solution has this identifier
	 */
	@Transactional
	public void back(Actor actor, UUID id, SolutionBackingRequest request) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = reviewable(id);
		solution.back(SolutionViews.text(request.backedBy()), SolutionViews.text(request.program()),
				SolutionViews.text(request.funding()), Instant.now());
		record(AuditAction.SOLUTION_BACK, operator, solution, Map.of());
		events.publishEvent(new SolutionChanged(id));
	}

	/**
	 * Sends a solution that waits for review back to its owners, with what to change. They correct it and send it
	 * again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist or does not wait for review
	 */
	@Transactional
	public void sendBack(Actor actor, UUID id, SendBackSolutionRequest request) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = reviewable(id);
		if (!solution.isInReview()) {
			throw notAwaiting(solution);
		}
		String reason = request.reason().strip();
		solution.sendBack(reason, Instant.now());
		record(AuditAction.SOLUTION_SEND_BACK, operator, solution, Map.of());
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.SENT_BACK, reason);
	}

	/**
	 * Refuses a solution that waits for review for good, with a reason its owners read; they cannot send it again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist or does not wait for review
	 */
	@Transactional
	public void reject(Actor actor, UUID id, RejectSolutionRequest request) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = reviewable(id);
		if (!solution.isInReview()) {
			throw notAwaiting(solution);
		}
		solution.reject(request.reason(), SolutionViews.text(request.message()), Instant.now());
		record(AuditAction.SOLUTION_REJECT, operator, solution, Map.of("reason", request.reason()));
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.REJECTED, null);
	}

	/**
	 * Takes an approved solution out of the directory and matching, with a reason its owners read. Its review stays
	 * approved, so restoring it needs no new review.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist, or is not approved or already taken down
	 */
	@Transactional
	public void takeDown(Actor actor, UUID id, TakeDownSolutionRequest request) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = reviewable(id);
		if (!solution.isApproved()) {
			throw new SolutionException(SolutionErrorCode.NOT_APPROVED, "Takedown of solution " + id + ", which is "
					+ solution.getStatus() + (solution.isTakenDown() ? " and taken down" : ""));
		}
		solution.takeDown(request.reason(), SolutionViews.text(request.message()), Instant.now());
		record(AuditAction.SOLUTION_TAKE_DOWN, operator, solution, Map.of("reason", request.reason()));
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.TAKEN_DOWN, null);
	}

	/**
	 * Puts a solution that was taken down back in the directory and matching without a new review.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist or is not taken down, or its organization is not
	 * approved
	 */
	@Transactional
	public void restore(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = reviewable(id);
		if (!solution.isTakenDown()) {
			throw new SolutionException(SolutionErrorCode.NOT_TAKEN_DOWN,
					"Restore of solution " + id + ", which is " + solution.getStatus() + " and not taken down");
		}
		if (!organizations.isApproved(solution.getOrganizationId())) {
			// Back in the directory means its organization is shown too.
			throw new SolutionException(SolutionErrorCode.ORGANIZATION_NOT_APPROVED,
					"Restore of solution " + id + " whose organization is not approved");
		}
		solution.restore();
		record(AuditAction.SOLUTION_RESTORE, operator, solution, Map.of());
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.RESTORED, null);
	}

	/**
	 * Approves a customer deployment that waits for review, which shows it with its solution.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the deployment does not exist or does not wait for review
	 */
	@Transactional
	public void approveDeployment(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		CustomerDeployment deployment = deployment(id);
		if (!deployment.isInReview()) {
			throw notAwaiting(deployment);
		}
		deployment.approve(Instant.now());
		record(AuditAction.SOLUTION_DEPLOYMENT_APPROVE, operator, deployment, Map.of());
		events.publishEvent(new SolutionChanged(deployment.getSolutionId()));
	}

	/**
	 * Rejects a customer deployment that waits for review, or takes an approved one off its solution, with a reason
	 * the owners read.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the deployment does not exist, or is neither waiting for review nor approved
	 */
	@Transactional
	public void rejectDeployment(Actor actor, UUID id, RejectCustomerDeploymentRequest request) {
		Operator operator = identity.requireOperator(actor);
		CustomerDeployment deployment = deployment(id);
		if (!deployment.isInReview() && !deployment.isApproved()) {
			throw notAwaiting(deployment);
		}
		deployment.reject(request.reason(), SolutionViews.text(request.message()), Instant.now());
		record(AuditAction.SOLUTION_DEPLOYMENT_REJECT, operator, deployment, Map.of("reason", request.reason()));
		events.publishEvent(new SolutionChanged(deployment.getSolutionId()));
	}

	private CustomerDeployment deployment(UUID id) {
		return deployments.findForUpdate(id)
			.orElseThrow(() -> new SolutionException(SolutionErrorCode.DEPLOYMENT_NOT_FOUND,
					"No customer deployment " + id));
	}

	private void record(AuditAction action, Operator operator, CustomerDeployment deployment,
			Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(CUSTOMER_DEPLOYMENT, deployment.getId().toString(), deployment.getTitle()),
				details));
	}

	private static SolutionException notAwaiting(CustomerDeployment deployment) {
		return new SolutionException(SolutionErrorCode.DEPLOYMENT_NOT_AWAITING_REVIEW,
				"Decision on customer deployment " + deployment.getId() + ", which is " + deployment.getStatus());
	}

	/** Tells every member of the solution's organization what GenAI Fund decided; a member not reached is skipped. */
	private void tell(Solution solution, EmailService.SolutionDecision decision, @Nullable String reason) {
		UUID organizationId = solution.getOrganizationId();
		String organization = name(organizations.names(List.of(organizationId)), organizationId);
		for (Person member : identity.people(organizations.memberAccountIds(organizationId)).values()) {
			email.sendSolutionDecision(member.email(), organization, solution.getName(), decision, reason);
		}
	}

	private Solution reviewable(UUID id) {
		return solutions.findForUpdate(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
	}

	private void record(AuditAction action, Operator operator, Solution solution, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(SOLUTION, solution.getId().toString(), solution.getName()), details));
	}

	private static String name(Map<UUID, OrganizationName> names, UUID organizationId) {
		OrganizationName name = names.get(organizationId);
		return name == null ? "" : name.name();
	}

	private static @Nullable String sender(Map<UUID, Person> senders, @Nullable UUID accountId) {
		Person person = accountId == null ? null : senders.get(accountId);
		return person == null ? null : person.label();
	}

	private static SolutionException notFound(UUID id) {
		return new SolutionException(SolutionErrorCode.SOLUTION_NOT_FOUND, "No submitted solution " + id);
	}

	private static SolutionException notAwaiting(Solution solution) {
		return new SolutionException(SolutionErrorCode.NOT_AWAITING_REVIEW,
				"Decision on solution " + solution.getId() + ", which is " + solution.getStatus());
	}
}
