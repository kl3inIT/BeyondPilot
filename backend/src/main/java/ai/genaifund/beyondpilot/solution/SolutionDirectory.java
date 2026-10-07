package ai.genaifund.beyondpilot.solution;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
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
import ai.genaifund.beyondpilot.storage.FileDownload;
import ai.genaifund.beyondpilot.storage.StorageService;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The public directory: the approved, listed solutions and their approved customer deployments, read by anyone
 * without a session. An approved solution left unlisted is read by its address alone. A deck is read at the address
 * of its solution.
 */
@Service
public class SolutionDirectory {

	static final int PAGE_SIZE = 12;

	private final SolutionRepository solutions;

	private final CustomerDeploymentRepository deployments;

	private final SolutionQueryRepository solutionList;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final StorageService storage;

	SolutionDirectory(SolutionRepository solutions, CustomerDeploymentRepository deployments,
			SolutionQueryRepository solutionList, OrganizationDirectory organizations, IdentityService identity,
			StorageService storage) {
		this.solutions = solutions;
		this.deployments = deployments;
		this.solutionList = solutionList;
		this.organizations = organizations;
		this.identity = identity;
		this.storage = storage;
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
			.approvedNames(rows.stream().map(SolutionQueryRepository.Row::organizationId).distinct().toList());
		return new PublicSolutionListResponse(rows.stream().filter(row -> names.containsKey(row.organizationId())).map(row -> {
			OrganizationName organization = names.get(row.organizationId());
			return new PublicSolutionSummaryResponse(row.slug(), row.name(), organization.name(), organization.slug(),
					organization.country(), row.summary(), row.maturity(), row.focusAreas(), row.industries(),
					shownLogo(row.logoFileId(), organization), row.coverFileId(), row.backing(), row.deployments());
		}).toList(), page, PAGE_SIZE, solutionList.publicCount(text, request.industry(), request.focusArea(),
				request.maturity(), organizationId));
	}

	/**
	 * One solution of the directory by its address.
	 * @throws SolutionException when no approved solution has the address; a draft, a submitted or a rejected one
	 * answers the same, so the address does not reveal that one exists. An approved solution the owners left unlisted
	 * is read by anyone who has its address, and says so
	 */
	@Transactional(readOnly = true)
	public PublicSolutionResponse get(String slug) {
		Solution solution = solutions.findBySlug(slug)
			.filter(Solution::isApproved)
			.orElseThrow(() -> notFound(slug));
		OrganizationName organization = organizations.approvedNames(List.of(solution.getOrganizationId()))
			.get(solution.getOrganizationId());
		if (organization == null) {
			throw notFound(slug);
		}
		return new PublicSolutionResponse(solution.getSlug(), solution.getName(), organization.name(),
				organization.slug(), organization.country(), solution.getSummary(), solution.getProblemsSolved(),
				solution.getValueProposition(), solution.getMaturity(), solution.getTraction(), solution.getBuiltWith(),
				solution.getIndustries(), solution.getFocusAreas(), solution.getLanguages(), solution.getDeployment(),
				solution.getChannels(), solution.getBestCustomerProfile(), SolutionViews.backing(solution),
				solution.getWebsite(), solution.getDemoUrl(),
				SolutionViews.publicDeck(solution), shownLogo(solution.getLogoFileId(), organization),
				solution.getCoverFileId(),
				solution.getImageFileIds(), solution.isListed(),
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
				solution.getSummary(), solution.getProblemsSolved(), solution.getMaturity());
	}

	/**
	 * The deck of the solution at this address. Anyone reads the deck of an approved solution, listed or not. Before
	 * the approval, and after a solution is taken down, the members of its organization read it, and so do the
	 * operators once it has been sent to them.
	 * @throws SolutionException when the solution has no deck or the reader may not have it; both answer the same, so
	 * the address does not reveal a solution that is not shown
	 * @throws ai.genaifund.beyondpilot.storage.StorageException when the file is gone from the store
	 */
	@Transactional(readOnly = true)
	public FileDownload deck(String slug, @Nullable Actor actor) {
		Solution solution = solutions.findBySlug(slug)
			.filter(found -> found.isApproved() || reads(actor, found))
			.orElseThrow(() -> notFound(slug));
		UUID deck = solution.getDeckFileId();
		if (deck == null) {
			throw notFound(slug);
		}
		return storage.download(deck);
	}

	/** Whether the caller reads a solution that is not approved: a member of its organization, or an operator. */
	private boolean reads(@Nullable Actor actor, Solution solution) {
		if (actor == null) {
			return false;
		}
		if (!solution.isDraft() && identity.isOperator(actor)) {
			return true;
		}
		return organizations.membershipOf(actor)
			.filter(membership -> membership.organizationId().equals(solution.getOrganizationId()))
			.isPresent();
	}

	/**
	 * An approved solution as search indexes it, listed or not; empty for any other, when it is taken down, or when its
	 * organization is not approved or is taken down.
	 */
	@Transactional(readOnly = true)
	public Optional<IndexedSolution> indexed(UUID solutionId) {
		return solutions.findById(solutionId).filter(Solution::isApproved).flatMap(solution -> indexed(List.of(solution))
			.stream()
			.findFirst());
	}

	/**
	 * A solution a visitor can find, by its address: approved, listed and not taken down, with an organization that is
	 * approved; empty for any other. For the MCP server's {@code fetch}.
	 */
	@Transactional(readOnly = true)
	public Optional<IndexedSolution> listed(String slug) {
		return solutions.findBySlug(slug)
			.filter(Solution::isApproved)
			.flatMap(solution -> indexed(List.of(solution)).stream().findFirst())
			.filter(IndexedSolution::listed);
	}

	/**
	 * An approved solution by its address, listed or not, not taken down, with an approved organization; empty for any
	 * other. For the operators' MCP server's {@code fetch}.
	 */
	@Transactional(readOnly = true)
	public Optional<IndexedSolution> approved(String slug) {
		return solutions.findBySlug(slug)
			.filter(Solution::isApproved)
			.flatMap(solution -> indexed(List.of(solution)).stream().findFirst());
	}

	/** Every approved solution not taken down as search indexes it, for a rebuild of the index. */
	@Transactional(readOnly = true)
	public List<IndexedSolution> indexedAll() {
		return indexed(solutions.findByStatusAndSuspendedAtIsNull(Solution.APPROVED));
	}

	/**
	 * The approved solutions of an organization as search indexes them, when what is shown of it changed; none while
	 * the organization is not approved or is taken down.
	 */
	@Transactional(readOnly = true)
	public List<IndexedSolution> indexedOf(UUID organizationId) {
		return indexed(solutions.findByOrganizationIdOrderByCreatedAtDesc(organizationId)
			.stream()
			.filter(Solution::isApproved)
			.toList());
	}

	/** Every solution of an organization, whatever its review, so search can take out those it no longer shows. */
	@Transactional(readOnly = true)
	public List<UUID> idsOf(UUID organizationId) {
		return solutions.findByOrganizationIdOrderByCreatedAtDesc(organizationId)
			.stream()
			.map(Solution::getId)
			.toList();
	}

	/**
	 * The logo a solution shows to the public: its own, or its organization's when it has none, so a provider that
	 * set one logo on its organization shows it on every solution. The owners' editor keeps the solution's own field.
	 */
	private static @Nullable UUID shownLogo(@Nullable UUID own, OrganizationName organization) {
		return own != null ? own : organization.logoFileId();
	}

	/** Those of these approved solutions whose organization is approved and not taken down. */
	private List<IndexedSolution> indexed(List<Solution> approved) {
		Map<UUID, OrganizationName> names = organizations
			.approvedNames(approved.stream().map(Solution::getOrganizationId).distinct().toList());
		return approved.stream().filter(solution -> names.containsKey(solution.getOrganizationId())).map(solution -> {
			OrganizationName organization = names.get(solution.getOrganizationId());
			return new IndexedSolution(solution.getId(), solution.getSlug(), solution.getName(),
					solution.getOrganizationId(), organization.name(), organization.slug(), organization.country(),
					solution.getSummary(), solution.getProblemsSolved(), solution.getValueProposition(),
					solution.getTraction(), solution.getBestCustomerProfile(), solution.getBuiltWith(),
					solution.getFocusAreas(), solution.getIndustries(), solution.getMaturity(),
					solution.getDeployment(), shownLogo(solution.getLogoFileId(), organization),
					deployments.countBySolutionIdAndStatus(solution.getId(), CustomerDeployment.APPROVED),
					solution.isListed());
		}).toList();
	}

	/**
	 * The approved solution at this address, listed or not, as another module needs it; empty when there is none.
	 */
	@Transactional(readOnly = true)
	public Optional<ApprovedSolution> approvedAt(String slug) {
		return solutions.findBySlug(slug)
			.filter(Solution::isApproved)
			.map(found -> new ApprovedSolution(found.getId(), found.getName(), found.getOrganizationId()));
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
		return new SolutionException(SolutionErrorCode.SOLUTION_NOT_FOUND, "No approved solution at " + slug);
	}
}
