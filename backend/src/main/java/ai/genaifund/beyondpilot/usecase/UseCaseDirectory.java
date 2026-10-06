package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListRequest;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListResponse;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseQueryRepository;
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

	private final OrganizationDirectory organizations;

	UseCaseDirectory(UseCaseQueryRepository useCaseList, OrganizationDirectory organizations) {
		this.useCaseList = useCaseList;
		this.organizations = organizations;
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
