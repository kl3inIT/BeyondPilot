package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListRequest;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListResponse;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.persistence.UseCase;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseQueryRepository;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The public list of use cases, read without a session: the published ones whose deadline has not passed. A use case
 * whose organization asked to stay anonymous shows no name, and no search finds it by that name.
 */
@Service
public class UseCaseDirectory {

	static final int PAGE_SIZE = 10;

	private static final int ORGANIZATION_LIMIT = 50;

	private final UseCaseQueryRepository useCaseList;

	private final UseCaseRepository useCases;

	private final OrganizationDirectory organizations;

	UseCaseDirectory(UseCaseQueryRepository useCaseList, UseCaseRepository useCases,
			OrganizationDirectory organizations) {
		this.useCaseList = useCaseList;
		this.useCases = useCases;
		this.organizations = organizations;
	}

	/**
	 * A published use case as search indexes it; empty for any other. One past its close date is still returned, and
	 * search leaves it out by that date.
	 */
	@Transactional(readOnly = true)
	public Optional<IndexedUseCase> indexed(UUID useCaseId) {
		return useCases.findById(useCaseId)
			.filter(useCase -> UseCase.PUBLISHED.equals(useCase.getStatus()) && useCase.getTitle() != null)
			.flatMap(useCase -> indexed(List.of(useCase)).stream().findFirst());
	}

	/** Every published use case as search indexes it, for a rebuild of the index. */
	@Transactional(readOnly = true)
	public List<IndexedUseCase> indexedAll() {
		return indexed(useCases.findByStatus(UseCase.PUBLISHED)
			.stream()
			.filter(useCase -> useCase.getTitle() != null)
			.toList());
	}

	private List<IndexedUseCase> indexed(List<UseCase> published) {
		Map<UUID, OrganizationName> names = organizations.names(published.stream()
			.filter(useCase -> !useCase.isHideOrganizationName())
			.map(UseCase::getOrganizationId)
			.collect(Collectors.toSet()));
		return published.stream().map(useCase -> {
			OrganizationName organization = useCase.isHideOrganizationName() ? null
					: names.get(useCase.getOrganizationId());
			boolean hidden = useCase.isBudgetMembersOnly();
			return new IndexedUseCase(useCase.getId(), useCase.getTitle(),
					organization == null ? null : organization.name(), useCase.getIndustry(),
					useCase.getTechnologies(), useCase.getProblemStatement(), useCase.getExpectedOutcomes(),
					hidden ? null : useCase.getBudgetMin(), hidden ? null : useCase.getBudgetMax(),
					useCase.isBudgetToBeDetermined(), hidden, useCase.getClosesAt());
		}).toList();
	}

	/** One page of the use cases the parameters select. */
	@Transactional(readOnly = true)
	public PublicUseCaseListResponse list(PublicUseCaseListRequest request) {
		String text = request.q() == null || request.q().isBlank() ? null : request.q().strip();
		int page = request.page() == null ? 1 : request.page();
		String sort = request.sort() == null ? "newest" : request.sort();
		Instant now = Instant.now();
		List<UUID> matching = text == null ? List.of()
				: organizations.approvedOrganizations(text, ORGANIZATION_LIMIT)
					.stream()
					.map(OrganizationName::id)
					.toList();
		List<UseCaseQueryRepository.PublicRow> rows = useCaseList.publicPage(text, matching, request.industry(), sort,
				now, PAGE_SIZE, (long) (page - 1) * PAGE_SIZE);
		Map<UUID, OrganizationName> names = organizations.names(rows.stream()
			.filter(row -> !row.hideOrganizationName())
			.map(UseCaseQueryRepository.PublicRow::organizationId)
			.collect(Collectors.toSet()));
		List<PublicUseCaseSummaryResponse> items = rows.stream().map(row -> summary(row, names)).toList();
		return new PublicUseCaseListResponse(items, page, PAGE_SIZE,
				useCaseList.publicCount(text, matching, request.industry(), now));
	}

	private static PublicUseCaseSummaryResponse summary(UseCaseQueryRepository.PublicRow row,
			Map<UUID, OrganizationName> names) {
		OrganizationName organization = row.hideOrganizationName() ? null : names.get(row.organizationId());
		boolean hidden = row.budgetMembersOnly();
		return new PublicUseCaseSummaryResponse(row.id(), row.title(), organization == null ? null : organization.name(),
				row.industry(), row.goal(), row.technologies(), hidden ? null : row.budgetMin(),
				hidden ? null : row.budgetMax(), row.budgetToBeDetermined(), row.budgetMembersOnly(),
				row.timelineMinWeeks(), row.timelineMaxWeeks(), row.closesAt(), row.publishedAt());
	}
}
