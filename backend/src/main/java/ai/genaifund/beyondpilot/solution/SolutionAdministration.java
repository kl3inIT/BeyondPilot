package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.RejectCustomerDeploymentRequest;
import ai.genaifund.beyondpilot.solution.dto.RejectSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionResponse;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeployment;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeploymentRepository;
import ai.genaifund.beyondpilot.solution.persistence.Solution;
import ai.genaifund.beyondpilot.solution.persistence.SolutionQueryRepository;
import ai.genaifund.beyondpilot.solution.persistence.SolutionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with solutions and their customer deployments: read those that were submitted, approve one,
 * reject one with a reason. Every
 * operation first checks that the caller is an operator now, and every decision is recorded in the audit trail in its
 * own transaction. A draft is its organization's alone and is never shown here.
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

	SolutionAdministration(SolutionRepository solutions, CustomerDeploymentRepository deployments,
			SolutionQueryRepository solutionList, OrganizationDirectory organizations, IdentityService identity,
			AuditTrail audit) {
		this.solutions = solutions;
		this.deployments = deployments;
		this.solutionList = solutionList;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
	}

	/**
	 * One page of the submitted solutions the request selects: those waiting for review first.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminSolutionListResponse list(Actor actor, AdminSolutionListRequest request) {
		identity.requireOperator(actor);
		String text = SolutionViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		List<SolutionQueryRepository.Row> rows = solutionList.adminPage(text, request.status(), PAGE_SIZE,
				(long) (page - 1) * PAGE_SIZE);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(SolutionQueryRepository.Row::organizationId).distinct().toList());
		return new AdminSolutionListResponse(
				rows.stream().map(row -> SolutionViews.summary(row, name(names, row.organizationId()))).toList(), page,
				PAGE_SIZE, solutionList.adminCount(text, request.status()));
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
				deployments.findBySolutionIdOrderByCreatedAtDesc(id));
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
		if (!solution.isSubmitted()) {
			throw notAwaiting(solution);
		}
		if (!organizations.isApproved(solution.getOrganizationId())) {
			// The directory lists a solution only when GenAI Fund has approved who offers it too.
			throw new SolutionException(SolutionErrorCode.ORGANIZATION_NOT_APPROVED,
					"Approval of solution " + id + " whose organization is not approved");
		}
		solution.approve(Instant.now());
		record(AuditAction.SOLUTION_APPROVE, operator, solution, Map.of());
	}

	/**
	 * Rejects a solution that waits for review, or takes an approved one out of the directory, with a reason its owners
	 * read.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the solution does not exist, or is neither waiting for review nor approved
	 */
	@Transactional
	public void reject(Actor actor, UUID id, RejectSolutionRequest request) {
		Operator operator = identity.requireOperator(actor);
		Solution solution = reviewable(id);
		if (!solution.isSubmitted() && !solution.isApproved()) {
			throw notAwaiting(solution);
		}
		solution.reject(request.reason(), SolutionViews.text(request.message()), Instant.now());
		record(AuditAction.SOLUTION_REJECT, operator, solution, Map.of("reason", request.reason()));
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
		if (!deployment.isSubmitted()) {
			throw notAwaiting(deployment);
		}
		deployment.approve(Instant.now());
		record(AuditAction.SOLUTION_DEPLOYMENT_APPROVE, operator, deployment, Map.of());
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
		if (!deployment.isSubmitted() && !deployment.isApproved()) {
			throw notAwaiting(deployment);
		}
		deployment.reject(request.reason(), SolutionViews.text(request.message()), Instant.now());
		record(AuditAction.SOLUTION_DEPLOYMENT_REJECT, operator, deployment, Map.of("reason", request.reason()));
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

	private static SolutionException notFound(UUID id) {
		return new SolutionException(SolutionErrorCode.SOLUTION_NOT_FOUND, "No submitted solution " + id);
	}

	private static SolutionException notAwaiting(Solution solution) {
		return new SolutionException(SolutionErrorCode.NOT_AWAITING_REVIEW,
				"Decision on solution " + solution.getId() + ", which is " + solution.getStatus());
	}
}
