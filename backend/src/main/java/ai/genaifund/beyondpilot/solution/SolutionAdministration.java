package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
import ai.genaifund.beyondpilot.organization.OrganizationProfile;
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.solution.dto.AdminCreateSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionOrganizationOptionResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionSummaryResponse;
import ai.genaifund.beyondpilot.solution.dto.RejectCustomerDeploymentRequest;
import ai.genaifund.beyondpilot.solution.dto.RejectSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SaveSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SendBackSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionBackingRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionBackingResponse;
import ai.genaifund.beyondpilot.solution.dto.SolutionDeckResponse;
import ai.genaifund.beyondpilot.solution.dto.SolutionResponse;
import ai.genaifund.beyondpilot.solution.dto.SolutionReviewQueueResponse;
import ai.genaifund.beyondpilot.solution.dto.TakeDownSolutionRequest;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeployment;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeploymentRepository;
import ai.genaifund.beyondpilot.solution.persistence.Solution;
import ai.genaifund.beyondpilot.solution.persistence.SolutionQueryRepository;
import ai.genaifund.beyondpilot.solution.persistence.SolutionRepository;
import ai.genaifund.beyondpilot.storage.StorageService;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with solutions and their customer deployments: read those that were sent for review, approve one,
 * send one back with what to change, refuse one for good with a reason, take an approved one down and restore it, and
 * feature one in the public directory.
 * Every operation first checks that the caller is an operator now, every decision is recorded in the audit trail in
 * the transaction of the change, and the members of the organization are told of a decision on a solution by email.
 * A draft is its organization's alone and is never shown here.
 */
@Service
public class SolutionAdministration {

	private static final Logger LOG = LoggerFactory.getLogger(SolutionAdministration.class);

	/** The days of a review queue are Vietnam's, as the screens show them. */
	private static final ZoneId QUEUE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

	static final int PAGE_SIZE = 25;

	/** How many organizations the operator's list of those to start a solution for holds. */
	static final int ORGANIZATION_LIMIT = 50;

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

	private final SolutionService service;

	SolutionAdministration(SolutionRepository solutions, CustomerDeploymentRepository deployments,
			SolutionQueryRepository solutionList, OrganizationDirectory organizations, IdentityService identity,
			AuditTrail audit, ApplicationEventPublisher events, StorageService storage, EmailService email,
			SolutionService service) {
		this.solutions = solutions;
		this.deployments = deployments;
		this.solutionList = solutionList;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
		this.events = events;
		this.storage = storage;
		this.email = email;
		this.service = service;
	}

	/**
	 * One page of the submitted solutions the request selects, in the order it asks for; without one, those waiting
	 * for review first. The text matches a
	 * solution by its name or by its organization's name.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminSolutionListResponse list(Actor actor, AdminSolutionListRequest request) {
		identity.requireOperator(actor);
		String text = SolutionViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		List<UUID> named = text == null ? List.of() : organizations.named(text);
		List<SolutionQueryRepository.Row> rows = solutionList.adminPage(text, named, request.organizationId(),
				request.status(), request.industry(), request.featured(), toReview(request), request.sort(), size,
				(long) (page - 1) * size);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(SolutionQueryRepository.Row::organizationId).distinct().toList());
		AdminSolutionOrganizationOptionResponse narrowedTo = request.organizationId() == null ? null
				: organizations.names(List.of(request.organizationId()))
					.values()
					.stream()
					.map(name -> new AdminSolutionOrganizationOptionResponse(name.id(), name.name()))
					.findFirst()
					.orElse(null);
		Map<UUID, Person> senders = identity.people(rows.stream()
			.map(SolutionQueryRepository.Row::submittedByAccountId)
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		return new AdminSolutionListResponse(rows.stream()
			.map(row -> SolutionViews.adminSummary(row, name(names, row.organizationId()),
					sender(senders, row.submittedByAccountId())))
			.toList(), narrowedTo, page, size,
			solutionList.adminCount(text, named, request.organizationId(), request.status(), request.industry(),
					request.featured(), toReview(request)),
			solutionList.awaitingReview(), solutionList.deploymentsAwaitingReview());
	}

	/** Whether the request keeps only the solutions holding a customer deployment that waits for review. */
	private static boolean toReview(AdminSolutionListRequest request) {
		return "to_review".equals(request.deployments());
	}

	/**
	 * Solutions as a spreadsheet: every page of the list as the request narrows it, in its order, for GenAI Fund to work
	 * with outside BeyondPilot. The download is recorded.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, AdminSolutionListRequest request, SpreadsheetFormat format) {
		Operator operator = identity.requireOperator(actor);
		List<AdminSolutionSummaryResponse> rows = Spreadsheet
			.everyPage(page -> list(actor, new AdminSolutionListRequest(request.q(), request.organizationId(), request.status(),
					request.industry(), request.featured(), request.deployments(), request.sort(), page,
					Spreadsheet.PAGE_SIZE)).items());
		Spreadsheet<AdminSolutionSummaryResponse> sheet = Spreadsheet.<AdminSolutionSummaryResponse>of("Solutions")
			.text("Solution", AdminSolutionSummaryResponse::name)
			.text("Organization", AdminSolutionSummaryResponse::organizationName)
			.paragraph("Summary", AdminSolutionSummaryResponse::summary)
			.text("Industries", solution -> String.join(", ", solution.industries()))
			.label("Maturity", AdminSolutionSummaryResponse::maturity)
			.group("Review")
			.label("Status", AdminSolutionSummaryResponse::status)
			.yesNo("Listed", AdminSolutionSummaryResponse::listed)
			.time("Featured since", AdminSolutionSummaryResponse::featuredAt)
			.time("Submitted at", AdminSolutionSummaryResponse::submittedAt)
			.text("Submitted by", AdminSolutionSummaryResponse::submittedBy)
			.count("Customer cases to review", AdminSolutionSummaryResponse::deploymentsAwaitingReview)
			.time("Taken down at", AdminSolutionSummaryResponse::suspendedAt)
			.ungrouped()
			.time("Updated at", AdminSolutionSummaryResponse::updatedAt)
			.text("Address", AdminSolutionSummaryResponse::slug);
		SpreadsheetFile file = sheet.write(format, "solutions", rows,
				Spreadsheet.About.of(operator.label(), Instant.now())
					.narrowedBy("Search", request.q())
					.narrowedBy("Organization", request.organizationId())
					.narrowedBy("Status", request.status())
					.narrowedBy("Industry", request.industry())
					.narrowedBy("Featured", request.featured())
					.narrowedBy("Customer deployments", request.deployments())
					.narrowedBy("Order", request.sort()));
		audit.record(new AuditRecord(AuditAction.SOLUTION_EXPORT,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("solution_list", "solutions", "Solutions"), Map.of("count", String.valueOf(file.rows()))));
		LOG.atInfo()
			.addKeyValue("event", "solution.list.exported")
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Solutions exported");
		return file;
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
				SolutionViews.sender(solution, identity),
				deployments.findBySolutionIdAndWithdrawnAtIsNullOrderByCreatedAtDesc(id),
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
		if (!organizations.isActive(solution.getOrganizationId())) {
			// The directory lists a solution only when who offers it is not taken down.
			throw new SolutionException(SolutionErrorCode.ORGANIZATION_NOT_APPROVED,
					"Approval of solution " + id + " whose organization is taken down");
		}
		solution.approve(Instant.now());
		record(AuditAction.SOLUTION_APPROVE, operator, solution, Map.of());
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.APPROVED, null);
	}

	/**
	 * The organizations that hold a submitted solution, for the operators' list to be narrowed to one, by name; at most
	 * {@value #ORGANIZATION_LIMIT}. Those taken down are among them, as their solutions are in the list.
	 * @param text only those whose name contains it, ignoring case and accents; every one when blank or null
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public List<AdminSolutionOrganizationOptionResponse> organizationsWithSolutions(Actor actor, @Nullable String text) {
		identity.requireOperator(actor);
		String named = SolutionViews.text(text);
		List<UUID> holding = solutionList.adminOrganizationIds();
		if (named != null) {
			Set<UUID> matching = Set.copyOf(organizations.named(named));
			holding = holding.stream().filter(matching::contains).toList();
		}
		return organizations.names(holding)
			.values()
			.stream()
			.map(name -> new AdminSolutionOrganizationOptionResponse(name.id(), name.name()))
			.sorted(Comparator.comparing(AdminSolutionOrganizationOptionResponse::name, String.CASE_INSENSITIVE_ORDER)
				.thenComparing(AdminSolutionOrganizationOptionResponse::id))
			.limit(ORGANIZATION_LIMIT)
			.toList();
	}

	/**
	 * The organizations not taken down a solution can be started for, by name; at most {@value #ORGANIZATION_LIMIT}.
	 * @param text only those whose name contains it, ignoring case; every one when blank or null
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public List<AdminSolutionOrganizationOptionResponse> organizationsToStartFor(Actor actor, @Nullable String text) {
		identity.requireOperator(actor);
		return organizations.activeOrganizations(text, ORGANIZATION_LIMIT)
			.stream()
			.map(organization -> new AdminSolutionOrganizationOptionResponse(organization.id(), organization.name()))
			.toList();
	}

	/**
	 * Starts a solution as a draft of an organization that is not taken down, for an operator to write in the editor and publish.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the organization is taken down
	 */
	@Transactional
	public SolutionResponse create(Actor actor, AdminCreateSolutionRequest request) {
		Operator operator = identity.requireOperator(actor);
		OrganizationName organization = organizations.activeOrganization(request.organizationId())
			.orElseThrow(() -> organizationNotApproved(request.organizationId()));
		Solution solution = service.start(actor, organization.id(), request.name());
		record(AuditAction.SOLUTION_CREATE, operator, solution, Map.of());
		return SolutionViews.solution(solution, organization.name(), null, List.of(), storage);
	}

	/**
	 * A draft as the editor of an operator reads it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist or is not a draft
	 */
	@Transactional(readOnly = true)
	public SolutionResponse draft(Actor actor, UUID id) {
		identity.requireOperator(actor);
		Solution solution = solutions.findById(id).orElseThrow(() -> draftNotFound(id));
		requireDraft(solution);
		return SolutionViews.solution(solution, organizationName(solution), SolutionViews.sender(solution, identity),
				deployments.findBySolutionIdOrderByCreatedAtDesc(id), storage);
	}

	/**
	 * Saves a draft as the editor of an operator holds it, by the rules of any save of a solution.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist, is not a draft, changed since the editor read it, or
	 * names a file the caller may not give it
	 */
	@Transactional
	public SolutionResponse saveDraft(Actor actor, UUID id, SaveSolutionRequest request) {
		identity.requireOperator(actor);
		Solution solution = solutions.findForUpdate(id).orElseThrow(() -> draftNotFound(id));
		requireDraft(solution);
		return service.write(actor, solution, organizationName(solution), request);
	}

	/**
	 * Publishes a draft at once: it is approved with no review, since the operator is GenAI Fund. Its organization is
	 * told as it is of any approved solution.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist, is not a draft, lacks what a submission needs, or
	 * belongs to an organization that is taken down
	 */
	@Transactional
	public void publish(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = solutions.findForUpdate(id).orElseThrow(() -> draftNotFound(id));
		requireDraft(solution);
		if (!solution.isComplete()) {
			throw new SolutionException(SolutionErrorCode.INCOMPLETE,
					"Publication of solution " + id + ", which lacks what a submission needs");
		}
		if (!organizations.isActive(solution.getOrganizationId())) {
			throw organizationNotApproved(solution.getOrganizationId());
		}
		Instant now = Instant.now();
		// The record names the operator as the sender, and no review lies between the two steps.
		solution.submit(now, operator.accountId());
		solution.approve(now);
		solutions.flush();
		record(AuditAction.SOLUTION_PUBLISH, operator, solution, Map.of());
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.APPROVED, null);
	}

	private String organizationName(Solution solution) {
		return name(organizations.names(List.of(solution.getOrganizationId())), solution.getOrganizationId());
	}

	private static void requireDraft(Solution solution) {
		if (!solution.isDraft()) {
			throw new SolutionException(SolutionErrorCode.NOT_A_DRAFT,
					"Edit by an operator of solution " + solution.getId() + ", which is " + solution.getStatus());
		}
	}

	private static SolutionException draftNotFound(UUID id) {
		return new SolutionException(SolutionErrorCode.SOLUTION_NOT_FOUND, "No solution " + id);
	}

	private static SolutionException organizationNotApproved(UUID organizationId) {
		return new SolutionException(SolutionErrorCode.ORGANIZATION_NOT_APPROVED,
				"Organization " + organizationId + " does not exist or is taken down");
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
	 * Sends a solution back with what to change, for a caller that is not the admin screen.
	 * @see #sendBack(Actor, UUID, SendBackSolutionRequest)
	 */
	@Transactional
	public void sendBack(Actor actor, UUID id, String reason) {
		sendBack(actor, id, new SendBackSolutionRequest(reason));
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
		if (!organizations.isActive(solution.getOrganizationId())) {
			// Back in the directory means its organization is shown too.
			throw new SolutionException(SolutionErrorCode.ORGANIZATION_NOT_APPROVED,
					"Restore of solution " + id + " whose organization is taken down");
		}
		solution.restore();
		record(AuditAction.SOLUTION_RESTORE, operator, solution, Map.of());
		events.publishEvent(new SolutionChanged(id));
		tell(solution, EmailService.SolutionDecision.RESTORED, null);
	}

	/**
	 * Features a solution: it comes first in the opening view of the public directory, where the reader has searched
	 * for nothing, chosen no filter and reads the newest first, the earliest featured on top; its card says Featured
	 * wherever the directory shows it. Any solution that was sent for review can be featured. A solution keeps being featured through every decision, so one
	 * featured before it is public comes first from the moment it is. Featuring one that is featured already changes
	 * nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when no submitted solution has this identifier
	 */
	@Transactional
	public void feature(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = solutions.findById(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
		if (solutions.feature(id, Instant.now()) == 1) {
			record(AuditAction.SOLUTION_FEATURE, operator, solution, Map.of());
		}
	}

	/**
	 * Stops featuring a solution, which goes back to its place among the others. On one that is not featured it changes
	 * nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when no submitted solution has this identifier
	 */
	@Transactional
	public void unfeature(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = solutions.findById(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
		if (solutions.unfeature(id) == 1) {
			record(AuditAction.SOLUTION_UNFEATURE, operator, solution, Map.of());
		}
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
		if (!deployment.isInReview() || deployment.isWithdrawn()) {
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
		if ((!deployment.isInReview() && !deployment.isApproved()) || deployment.isWithdrawn()) {
			throw notAwaiting(deployment);
		}
		deployment.reject(request.reason(), SolutionViews.text(request.message()), Instant.now());
		record(AuditAction.SOLUTION_DEPLOYMENT_REJECT, operator, deployment, Map.of("reason", request.reason()));
		events.publishEvent(new SolutionChanged(deployment.getSolutionId()));
	}

	/**
	 * Rejects a customer deployment, for a caller that is not the admin screen.
	 * @param reason {@code incomplete}, {@code unverifiable} or {@code other}
	 * @see #rejectDeployment(Actor, UUID, RejectCustomerDeploymentRequest)
	 */
	@Transactional
	public void rejectDeployment(Actor actor, UUID id, String reason, @Nullable String message) {
		rejectDeployment(actor, id, new RejectCustomerDeploymentRequest(reason, message));
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
				"Decision on customer deployment " + deployment.getId() + ", which is " + deployment.getStatus()
						+ (deployment.isWithdrawn() ? " and withdrawn" : ""));
	}

	/** Tells every member of the solution's organization what GenAI Fund decided; a member not reached is skipped. */
	private void tell(Solution solution, EmailService.SolutionDecision decision, @Nullable String reason) {
		UUID organizationId = solution.getOrganizationId();
		String organization = name(organizations.names(List.of(organizationId)), organizationId);
		// The public page answers only for an approved solution of an organization that is not taken down.
		@Nullable String publicSlug = solution.isApproved()
				&& organizations.profile(organizationId).filter(OrganizationProfile::active).isPresent()
						? solution.getSlug() : null;
		for (Person member : identity.people(organizations.memberAccountIds(organizationId)).values()) {
			email.sendSolutionDecision(member.email(), organization, solution.getName(), decision, reason,
					solution.getId(), publicSlug);
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

	/**
	 * The solutions waiting for an operator's review, at most this many, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public SolutionsAwaitingReview awaitingReview(Actor actor, int limit) {
		identity.requireOperator(actor);
		List<SolutionQueryRepository.Row> rows = solutionList.adminPage(null, List.of(), null, "in_review", null, null,
				false, null, limit, 0);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(SolutionQueryRepository.Row::organizationId).distinct().toList());
		return new SolutionsAwaitingReview(solutionList.awaitingReview(), solutionList.deploymentsAwaitingReview(),
				rows.stream()
					.map(row -> new SolutionsAwaitingReview.Item(row.id(), row.name(),
							names.containsKey(row.organizationId()) ? names.get(row.organizationId()).name() : null,
							row.summary(), row.submittedAt()))
					.toList());
	}

	/**
	 * One page of the operators' list of submitted solutions, in its own order, for the MCP server.
	 * @param status one of the list's statuses, or null for every one
	 * @param q only solutions whose name, or whose organization's name, contains it; every one when null
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public SolutionReviewList reviewList(Actor actor, @Nullable String status, @Nullable String q, int page,
			int size) {
		AdminSolutionListResponse found = list(actor,
				new AdminSolutionListRequest(q, null, status, null, null, null, null, page, size));
		return new SolutionReviewList(found.total(), found.items()
			.stream()
			.map(item -> new SolutionReviewList.Item(item.id(), item.name(), item.organizationName(), item.summary(),
					item.industries(), item.maturity(), item.status(), item.suspendedAt(), item.listed(),
					item.featuredAt(), item.submittedAt(), item.submittedBy(), item.updatedAt(),
					item.deploymentsAwaitingReview()))
			.toList());
	}

	/**
	 * One submitted solution as its admin page shows it, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when no submitted solution has this identifier
	 */
	@Transactional(readOnly = true)
	public SolutionReviewRecord reviewRecord(Actor actor, UUID id) {
		SolutionResponse found = get(actor, id);
		SolutionBackingResponse backing = found.backing();
		SolutionDeckResponse deck = found.deck();
		return new SolutionReviewRecord(found.id(), found.slug(), found.name(), found.organizationId(),
				found.organizationName(), found.summary(), found.problemsSolved(), found.valueProposition(),
				found.maturity(), found.traction(), found.builtWith(), found.industries(), found.focusAreas(),
				found.languages(), found.deployment(), found.channels(), found.bestCustomerProfile(), found.website(),
				found.demoUrl(), deck == null ? null : deck.fileName(),
				backing == null ? null
						: new SolutionReviewRecord.Backing(backing.backedBy(), backing.program(), backing.funding()),
				found.status(), found.decisionReason(),
				found.decisionMessage(), found.suspendedAt(), found.suspensionReason(), found.suspensionMessage(),
				found.listed(), found.featuredAt(), found.complete(), found.submittedAt(), found.submittedBy(),
				found.updatedAt(),
				found.customerDeployments()
					.stream()
					.map(deployment -> new SolutionReviewRecord.Deployment(deployment.id(), deployment.title(),
							deployment.customer(), deployment.problem(), deployment.delivered(), deployment.stage(),
							deployment.period(), deployment.result(), deployment.status(),
							deployment.decisionReason(), deployment.decisionMessage(), deployment.withdrawnAt(),
							deployment.updatedAt()))
					.toList());
	}

	/**
	 * How many solutions wait for review now, since when the oldest has waited, and how many
	 * waited at the end of each of the last 14 days, for the admin home.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public SolutionReviewQueueResponse queue(Actor actor) {
		identity.requireOperator(actor);
		LocalDate today = LocalDate.now(QUEUE_ZONE);
		List<Long> days = solutionList.solutionsWaitingByDay(today);
		return new SolutionReviewQueueResponse(days.getLast(), solutionList.solutionsOldestWaiting(),
				today.minusDays(days.size() - 1L), days);
	}

	/**
	 * How many customer deployments wait for review now, since when the oldest has waited, and how many
	 * waited at the end of each of the last 14 days, for the admin home.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public SolutionReviewQueueResponse deploymentQueue(Actor actor) {
		identity.requireOperator(actor);
		LocalDate today = LocalDate.now(QUEUE_ZONE);
		List<Long> days = solutionList.deploymentsWaitingByDay(today);
		return new SolutionReviewQueueResponse(days.getLast(), solutionList.deploymentsOldestWaiting(),
				today.minusDays(days.size() - 1L), days);
	}

}
