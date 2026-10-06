package ai.genaifund.beyondpilot.solution;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.solution.dto.PublicCustomerDeploymentListRequest;
import ai.genaifund.beyondpilot.solution.dto.PublicCustomerDeploymentListResponse;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionResponse;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionSummaryResponse;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeployment;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeploymentRepository;
import ai.genaifund.beyondpilot.solution.persistence.Solution;
import ai.genaifund.beyondpilot.solution.persistence.SolutionQueryRepository;
import ai.genaifund.beyondpilot.solution.persistence.SolutionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The public directory: the approved, listed solutions and their approved customer deployments, read by anyone
 * without a session.
 */
@Service
public class SolutionDirectory {

	static final int PAGE_SIZE = 12;

	private final SolutionRepository solutions;

	private final CustomerDeploymentRepository deployments;

	private final SolutionQueryRepository solutionList;

	private final OrganizationDirectory organizations;

	SolutionDirectory(SolutionRepository solutions, CustomerDeploymentRepository deployments,
			SolutionQueryRepository solutionList, OrganizationDirectory organizations) {
		this.solutions = solutions;
		this.deployments = deployments;
		this.solutionList = solutionList;
		this.organizations = organizations;
	}

	/** One page of the directory the request selects, in the order it asks for. */
	@Transactional(readOnly = true)
	public PublicSolutionListResponse list(PublicSolutionListRequest request) {
		String text = SolutionViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		UUID organizationId = null;
		if (request.organization() != null) {
			Optional<OrganizationName> organization = organizations.approvedAt(request.organization());
			if (organization.isEmpty()) {
				// An address no approved organization has selects nothing.
				return new PublicSolutionListResponse(List.of(), page, PAGE_SIZE, 0);
			}
			organizationId = organization.get().id();
		}
		List<SolutionQueryRepository.Row> rows = solutionList.publicPage(text, request.industry(),
				request.focusArea(), request.maturity(), organizationId, request.sort(), PAGE_SIZE,
				(long) (page - 1) * PAGE_SIZE);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(SolutionQueryRepository.Row::organizationId).distinct().toList());
		return new PublicSolutionListResponse(rows.stream().filter(row -> names.containsKey(row.organizationId())).map(row -> {
			OrganizationName organization = names.get(row.organizationId());
			return new PublicSolutionSummaryResponse(row.slug(), row.name(), organization.name(), organization.slug(),
					organization.country(), row.summary(), row.maturity(), row.focusAreas(), row.industries(),
					row.deployments());
		}).toList(), page, PAGE_SIZE, solutionList.publicCount(text, request.industry(), request.focusArea(),
				request.maturity(), organizationId));
	}

	/**
	 * One solution of the directory by its address.
	 * @throws SolutionException when no approved, listed solution has the address; a draft or an unlisted one answers
	 * the same, so the address does not reveal that one exists
	 */
	@Transactional(readOnly = true)
	public PublicSolutionResponse get(String slug) {
		Solution solution = solutions.findBySlug(slug)
			.filter(found -> found.isApproved() && found.isListed())
			.orElseThrow(() -> notFound(slug));
		OrganizationName organization = organizations.names(List.of(solution.getOrganizationId()))
			.get(solution.getOrganizationId());
		if (organization == null) {
			throw notFound(slug);
		}
		return new PublicSolutionResponse(solution.getSlug(), solution.getName(), organization.name(),
				organization.slug(), organization.country(), solution.getSummary(), solution.getProblemsSolved(),
				solution.getValueProposition(), solution.getFocusAreas(), solution.getIndustries(),
				solution.getMaturity(), solution.getDeployment(), solution.getWebsite(),
				deployments.findBySolutionIdAndStatusOrderByDecidedAtDesc(solution.getId(), CustomerDeployment.APPROVED)
					.stream()
					.map(deployment -> SolutionViews.publicDeployment(deployment, solution))
					.toList());
	}

	/** The solutions of an organization, the newest first, for the module that applies with one. */
	@Transactional(readOnly = true)
	public List<OfferedSolution> offeredBy(UUID organizationId) {
		return solutions.findByOrganizationIdOrderByCreatedAtDesc(organizationId)
			.stream()
			.map(SolutionDirectory::offered)
			.toList();
	}

	/** One solution, for the module that applies with it; empty when it does not exist. */
	@Transactional(readOnly = true)
	public Optional<OfferedSolution> offered(UUID solutionId) {
		return solutions.findById(solutionId).map(SolutionDirectory::offered);
	}

	private static OfferedSolution offered(Solution solution) {
		return new OfferedSolution(solution.getId(), solution.getOrganizationId(), solution.getName(),
				solution.getSummary(), solution.getProblemsSolved(), solution.getMaturity(), solution.getDeckFileId(),
				solution.getDemoUrl(), solution.getBuiltWith(), solution.getTraction());
	}

	/** The approved, listed solution at this address, as another module needs it; empty when there is none. */
	@Transactional(readOnly = true)
	public Optional<ListedSolution> listedAt(String slug) {
		return solutions.findBySlug(slug)
			.filter(found -> found.isApproved() && found.isListed())
			.map(found -> new ListedSolution(found.getId(), found.getName(), found.getOrganizationId()));
	}

	/**
	 * One page of the approved customer deployments of an organization's listed solutions, the most recently approved
	 * first. An address no approved organization has selects nothing.
	 */
	@Transactional(readOnly = true)
	public PublicCustomerDeploymentListResponse deployments(PublicCustomerDeploymentListRequest request) {
		int page = request.page() == null ? 1 : request.page();
		Optional<OrganizationName> organization = organizations.approvedAt(request.organization());
		if (organization.isEmpty()) {
			return new PublicCustomerDeploymentListResponse(List.of(), page, PAGE_SIZE, 0);
		}
		UUID organizationId = organization.get().id();
		List<CustomerDeployment> found = deployments.findPublicByOrganization(organizationId,
				PageRequest.of(page - 1, PAGE_SIZE));
		Map<UUID, Solution> used = solutions
			.findAllById(found.stream().map(CustomerDeployment::getSolutionId).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Solution::getId, Function.identity()));
		return new PublicCustomerDeploymentListResponse(
				found.stream()
					.map(deployment -> SolutionViews.publicDeployment(deployment, used.get(deployment.getSolutionId())))
					.toList(),
				page, PAGE_SIZE, deployments.countPublicByOrganization(organizationId));
	}

	private static SolutionException notFound(String slug) {
		return new SolutionException(SolutionErrorCode.SOLUTION_NOT_FOUND, "No listed solution at " + slug);
	}
}
