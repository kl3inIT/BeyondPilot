package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.program.ProgramName;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.storage.StoredFile;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListRequest;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListResponse;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseResponse;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.persistence.UseCase;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseQueryRepository;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRepository;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRequirement;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The public list of use cases, read without a session: the published ones whose deadline has not passed. A use case
 * whose organization asked to stay anonymous shows no name, and no search finds it by that name.
 */
@Service
@EnableConfigurationProperties(UseCaseProperties.class)
public class UseCaseDirectory {

	static final int PAGE_SIZE = 10;

	private static final int ORGANIZATION_LIMIT = 50;

	private final UseCaseQueryRepository useCaseList;

	private final UseCaseRepository useCases;

	private final OrganizationDirectory organizations;

	private final ProgramService programs;

	private final UseCaseProperties properties;

	private final StorageService storage;

	UseCaseDirectory(UseCaseQueryRepository useCaseList, UseCaseRepository useCases,
			OrganizationDirectory organizations, ProgramService programs, UseCaseProperties properties,
			StorageService storage) {
		this.storage = storage;
		this.useCaseList = useCaseList;
		this.useCases = useCases;
		this.organizations = organizations;
		this.programs = programs;
		this.properties = properties;
	}

	/**
	 * A published use case as search indexes it; empty for any other, or when its organization is not approved or is
	 * taken down. One past its close date is still returned, and search leaves it out by that date.
	 */
	@Transactional(readOnly = true)
	public Optional<IndexedUseCase> indexed(UUID useCaseId) {
		return useCases.findById(useCaseId)
			.filter(useCase -> UseCase.APPROVED.equals(useCase.getStatus()) && useCase.getTitle() != null)
			.flatMap(useCase -> indexed(List.of(useCase)).stream().findFirst());
	}

	/**
	 * Everything a published use case says, with its attached files, for matching; empty for a use case that is not
	 * published. One past its close date is still returned: its candidates stay readable.
	 */
	@Transactional(readOnly = true)
	public Optional<UseCaseBrief> brief(UUID useCaseId) {
		return useCases.findById(useCaseId)
			.filter(useCase -> UseCase.APPROVED.equals(useCase.getStatus()) && useCase.getTitle() != null)
			.map(useCase -> {
				Map<UUID, StoredFile> files = storage.describe(useCase.getAttachmentFileIds());
				List<UseCaseBrief.Attachment> attachments = useCase.getAttachmentFileIds()
					.stream()
					.map(files::get)
					.filter(Objects::nonNull)
					.map(file -> new UseCaseBrief.Attachment(file.id(), file.fileName(), file.mediaType(),
							storage.content(file.id())))
					.toList();
				List<UseCaseBrief.Stated> stated = useCase.getRequirements()
					.stream()
					.map(requirement -> new UseCaseBrief.Stated(requirement.statement(),
							UseCaseRequirement.REQUIRED.equals(requirement.necessity())))
					.toList();
				return new UseCaseBrief(useCase.getId(), useCase.getOrganizationId(),
						Objects.requireNonNull(useCase.getTitle()), useCase.getIndustry(),
						List.copyOf(useCase.getTechnologies()), useCase.getProblemStatement(),
						useCase.getExpectedOutcomes(), useCase.getCurrentProcess(), useCase.getCurrentSolutions(),
						useCase.getTargetUsers(), useCase.getDataReadiness(), useCase.getIntegrationRequirements(),
						stated, attachments);
			});
	}

	/** Every published use case as search indexes it, for a rebuild of the index. */
	@Transactional(readOnly = true)
	public List<IndexedUseCase> indexedAll() {
		return indexed(useCases.findByStatus(UseCase.APPROVED)
			.stream()
			.filter(useCase -> useCase.getTitle() != null)
			.toList());
	}

	/**
	 * The published use cases of an organization as search indexes them, when what is shown of it changed; none while
	 * the organization is not approved or is taken down.
	 */
	@Transactional(readOnly = true)
	public List<IndexedUseCase> indexedOf(UUID organizationId) {
		return indexed(useCases.findByOrganizationIdOrderByUpdatedAtDescIdAsc(organizationId)
			.stream()
			.filter(useCase -> UseCase.APPROVED.equals(useCase.getStatus()) && useCase.getTitle() != null)
			.toList());
	}

	/** Every use case of an organization, whatever its status, so search can take out those it no longer shows. */
	@Transactional(readOnly = true)
	public List<UUID> idsOf(UUID organizationId) {
		return useCases.findByOrganizationIdOrderByUpdatedAtDescIdAsc(organizationId)
			.stream()
			.map(UseCase::getId)
			.toList();
	}

	/** Those of these published use cases whose organization is approved and not taken down. */
	private List<IndexedUseCase> indexed(List<UseCase> published) {
		Map<UUID, OrganizationName> names = organizations
			.approvedNames(published.stream().map(UseCase::getOrganizationId).collect(Collectors.toSet()));
		return published.stream().filter(useCase -> names.containsKey(useCase.getOrganizationId())).map(useCase -> {
			OrganizationName organization = useCase.isHideOrganizationName() ? null
					: names.get(useCase.getOrganizationId());
			boolean hidden = useCase.isBudgetMembersOnly();
			return new IndexedUseCase(useCase.getId(), useCase.getTitle(),
					organization == null ? null : organization.name(), useCase.getIndustry(),
					useCase.getTechnologies(), useCase.getExpectedOutcomes(),
					hidden ? null : useCase.getBudgetMin(), hidden ? null : useCase.getBudgetMax(),
					useCase.getCurrency(), useCase.isBudgetToBeDetermined(), hidden, useCase.getClosesAt());
		}).toList();
	}

	/** One page of the use cases the parameters select. */
	@Transactional(readOnly = true)
	public PublicUseCaseListResponse list(PublicUseCaseListRequest request) {
		String text = request.q() == null || request.q().isBlank() ? null : request.q().strip();
		int page = request.page() == null ? 1 : request.page();
		String sort = request.sort() == null ? "newest" : request.sort();
		Instant now = Instant.now();
		UUID program = null;
		if (request.program() != null) {
			Optional<ProgramName> named = programs.named(request.program());
			if (named.isEmpty() || !named.get().published()) {
				// A program a visitor cannot see features nothing for them.
				return new PublicUseCaseListResponse(List.of(), page, PAGE_SIZE, 0);
			}
			program = named.get().id();
		}
		List<UUID> matching = text == null ? List.of()
				: organizations.approvedOrganizations(text, ORGANIZATION_LIMIT)
					.stream()
					.map(OrganizationName::id)
					.toList();
		List<UseCaseQueryRepository.PublicRow> rows = useCaseList.publicPage(text, matching, request.industry(), program,
				sort, properties.vndPerUsd(), now, PAGE_SIZE, (long) (page - 1) * PAGE_SIZE);
		Map<UUID, OrganizationName> names = organizations.names(rows.stream()
			.filter(row -> !row.hideOrganizationName())
			.map(UseCaseQueryRepository.PublicRow::organizationId)
			.collect(Collectors.toSet()));
		List<PublicUseCaseSummaryResponse> items = rows.stream().map(row -> summary(row, names)).toList();
		return new PublicUseCaseListResponse(items, page, PAGE_SIZE,
				useCaseList.publicCount(text, matching, request.industry(), program, now));
	}

	/**
	 * One published use case that is still open, as a visitor reads the whole brief.
	 * @throws UseCaseException when the identifier is unknown, no longer open, or its organization is not public
	 */
	@Transactional(readOnly = true)
	public PublicUseCaseResponse get(UUID id) {
		Instant now = Instant.now();
		UseCase useCase = useCases.findById(id)
			.filter(found -> UseCase.APPROVED.equals(found.getStatus()) && !UseCase.CLOSED.equals(found.statusAt(now)))
			.orElseThrow(() -> notFound(id));
		String title = useCase.getTitle();
		String industry = useCase.getIndustry();
		Instant publishedAt = useCase.getPublishedAt();
		if (title == null || industry == null || publishedAt == null) {
			throw notFound(id);
		}
		OrganizationName organization = organizations.approvedNames(List.of(useCase.getOrganizationId()))
			.get(useCase.getOrganizationId());
		if (organization == null) {
			throw notFound(id);
		}
		boolean anonymous = useCase.isHideOrganizationName();
		boolean hiddenBudget = useCase.isBudgetMembersOnly();
		return new PublicUseCaseResponse(useCase.getId(), title, anonymous ? null : organization.name(),
				anonymous ? null : organization.logoFileId(), industry, useCase.getProblemStatement(),
				useCase.getTechnologies(), useCase.getExpectedOutcomes(), useCase.getCurrentProcess(),
				useCase.getCurrentSolutions(), useCase.getTargetUsers(), useCase.getDataReadiness(),
				useCase.getIntegrationRequirements(), hiddenBudget ? null : useCase.getBudgetMin(),
				hiddenBudget ? null : useCase.getBudgetMax(), useCase.getCurrency(), useCase.isBudgetToBeDetermined(),
				hiddenBudget, useCase.getTimelineMinWeeks(), useCase.getTimelineMaxWeeks(), useCase.getClosesAt(),
				publishedAt);
	}

	private static PublicUseCaseSummaryResponse summary(UseCaseQueryRepository.PublicRow row,
			Map<UUID, OrganizationName> names) {
		OrganizationName organization = row.hideOrganizationName() ? null : names.get(row.organizationId());
		boolean hidden = row.budgetMembersOnly();
		return new PublicUseCaseSummaryResponse(row.id(), row.title(), organization == null ? null : organization.name(),
				organization == null ? null : organization.logoFileId(), row.industry(), row.goal(), row.technologies(), hidden ? null : row.budgetMin(),
				hidden ? null : row.budgetMax(), row.currency(), row.budgetToBeDetermined(), row.budgetMembersOnly(),
				row.timelineMinWeeks(), row.timelineMaxWeeks(), row.closesAt(), row.publishedAt());
	}

	private static UseCaseException notFound(UUID id) {
		return new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No published use case " + id);
	}
}
