package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.notification.NotificationException;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.program.ProgramName;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseListRequest;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseListResponse;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseResponse;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.dto.CreateUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.SendBackUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.SetUseCaseProgramsRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCasePersonResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAttachmentResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationListRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationListResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseProgramResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseRequirementEntry;
import ai.genaifund.beyondpilot.usecase.persistence.UseCase;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseQueryRepository;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRepository;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRequirement;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with use cases. Every operation first checks that the caller is an operator now, and a change is
 * recorded in the audit trail in the transaction of the change.
 */
@Service
public class UseCaseAdministration {

	private static final Logger LOG = LoggerFactory.getLogger(UseCaseAdministration.class);

	static final int PAGE_SIZE = 25;

	private static final int ORGANIZATION_LIMIT = 50;

	private static final String USE_CASE = "use_case";

	private final UseCaseRepository useCases;

	private final UseCaseQueryRepository useCaseList;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final UseCaseAttachments files;

	private final UseCasePeople people;

	private final EmailService email;

	private final ApplicationEventPublisher events;

	private final ProgramService programs;

	UseCaseAdministration(UseCaseRepository useCases, UseCaseQueryRepository useCaseList,
			OrganizationDirectory organizations, IdentityService identity, AuditTrail audit, UseCaseAttachments files,
			UseCasePeople people, EmailService email, ApplicationEventPublisher events, ProgramService programs) {
		this.events = events;
		this.programs = programs;
		this.useCases = useCases;
		this.useCaseList = useCaseList;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
		this.files = files;
		this.people = people;
		this.email = email;
	}

	/**
	 * One page of use cases in any status, the newest first, each as it reads now: closed once its date has passed.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminUseCaseListResponse list(Actor actor, AdminUseCaseListRequest request) {
		identity.requireOperator(actor);
		String text = text(request.q());
		int page = request.page() == null ? 1 : request.page();
		Instant now = Instant.now();
		List<UUID> matching = text == null ? List.of()
				: organizations.approvedOrganizations(text, ORGANIZATION_LIMIT).stream().map(OrganizationName::id).toList();
		List<UseCaseQueryRepository.Row> rows = useCaseList.page(text, matching, request.organizationId(),
				request.status(), now, PAGE_SIZE, (long) (page - 1) * PAGE_SIZE);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(UseCaseQueryRepository.Row::organizationId).collect(Collectors.toSet()));
		List<AdminUseCaseSummaryResponse> items = rows.stream()
			.map(row -> new AdminUseCaseSummaryResponse(row.id(), organization(row.organizationId(), names),
					row.title(), row.status(), row.closesAt(), row.updatedAt()))
			.toList();
		return new AdminUseCaseListResponse(items, page, PAGE_SIZE,
				useCaseList.count(text, matching, request.organizationId(), request.status(), now),
				useCaseList.inReview(now));
	}

	/**
	 * One use case as an operator reads it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist
	 */
	@Transactional(readOnly = true)
	public AdminUseCaseResponse get(Actor actor, UUID id) {
		identity.requireOperator(actor);
		UseCase useCase = useCases.findById(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		Map<UUID, OrganizationName> names = organizations.names(Set.of(useCase.getOrganizationId()));
		return response(actor, useCase, organization(useCase.getOrganizationId(), names), Instant.now());
	}

	/**
	 * The approved organizations that can have use cases, by name; at most 50.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public UseCaseOrganizationListResponse organizations(Actor actor, UseCaseOrganizationListRequest request) {
		identity.requireOperator(actor);
		return new UseCaseOrganizationListResponse(organizations.approvedOrganizations(request.q(), ORGANIZATION_LIMIT)
			.stream()
			.map(organization -> new UseCaseOrganizationResponse(organization.id(), organization.name()))
			.toList());
	}

	/**
	 * Creates a use case for an organization: a draft its members will edit, or a published one when the operator
	 * asks. An operator's own work needs no review, so nothing is created in review.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the organization is not approved, the close date is not in the
	 * future, or the budget or the timeline is out of order
	 */
	@Transactional
	public AdminUseCaseResponse create(Actor actor, CreateUseCaseRequest request) {
		Operator operator = identity.requireOperator(actor);
		Instant now = Instant.now();
		OrganizationName organization = organizations.approvedOrganization(request.organizationId())
			.orElseThrow(() -> refused(UseCaseErrorCode.ORGANIZATION_NOT_ELIGIBLE,
					"Organization " + request.organizationId() + " is not an approved organization"));
		Instant closesAt = request.closesAt();
		if (closesAt != null && !closesAt.isAfter(now)) {
			throw refused(UseCaseErrorCode.CLOSES_IN_THE_PAST, "Close date " + closesAt + " is not after " + now);
		}
		checkBudget(request);
		Integer minWeeks = request.timelineMinWeeks();
		Integer maxWeeks = request.timelineMaxWeeks();
		if ((minWeeks == null) != (maxWeeks == null)) {
			throw refused(UseCaseErrorCode.TIMELINE_OUT_OF_ORDER, "Timeline with one end only");
		}
		if (minWeeks != null && maxWeeks != null && minWeeks > maxWeeks) {
			throw refused(UseCaseErrorCode.TIMELINE_OUT_OF_ORDER, "Timeline " + request.timelineMinWeeks() + " to "
					+ request.timelineMaxWeeks() + " weeks");
		}
		// An operator may leave out what a brief does not say; only a member's own submission needs every part.
		UseCase useCase = new UseCase(organization.id(), operator.accountId(), closesAt);
		useCase.describe(request.title().strip(), request.problemStatement().strip(), request.industry(),
				request.technologies() == null ? List.of() : request.technologies().stream().distinct().toList());
		useCase.explain(request.expectedOutcomes().strip(), text(request.currentProcess()),
				text(request.currentSolutions()), text(request.targetUsers()));
		useCase.specify(
				(request.requirements() == null ? List.<UseCaseRequirementEntry>of() : request.requirements())
					.stream()
					.map(requirement -> new UseCaseRequirement(requirement.statement().strip(), requirement.necessity()))
					.toList(),
				text(request.dataReadiness()), text(request.integrationRequirements()));
		useCase.budget(currencyOf(request.currency()), request.budgetMin(), request.budgetMax(),
				request.budgetToBeDetermined(), request.budgetMembersOnly());
		useCase.belongTo(programsNamed(request.programIds() == null ? List.of() : request.programIds()).keySet());
		List<UUID> attachments = request.attachmentFileIds() == null ? List.of() : request.attachmentFileIds();
		files.requireUsable(actor, attachments, List.of());
		useCase.attach(attachments);
		useCase.takeWeeks(minWeeks, maxWeeks);
		useCase.showCompanyName(request.hideOrganizationName());
		if (request.publishNow()) {
			useCase.publish(now);
		}
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		audit.record(new AuditRecord(AuditAction.USE_CASE_CREATE,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(), useCase.getTitle()),
				Map.of("organization", organization.id().toString(), "status", useCase.getStatus())));
		return response(actor, useCase, new UseCaseOrganizationResponse(organization.id(), organization.name()), now);
	}

	/**
	 * Approves a use case in review: it is published at once, and its organization's members are told.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when there is no such use case, or it is not in review
	 */
	@Transactional
	public AdminUseCaseResponse approve(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Instant now = Instant.now();
		UseCase useCase = awaitingReview(id, now);
		useCase.approve(operator.accountId(), now);
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		return decided(actor, operator, AuditAction.USE_CASE_APPROVE, useCase, true, null, now);
	}

	/**
	 * Sends a use case in review back to its organization with what to change; its members are told.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when there is no such use case, or it is neither in review nor published
	 */
	@Transactional
	public AdminUseCaseResponse sendBack(Actor actor, UUID id, SendBackUseCaseRequest request) {
		Operator operator = identity.requireOperator(actor);
		Instant now = Instant.now();
		UseCase useCase = decidable(id, now, UseCase.IN_REVIEW, UseCase.APPROVED);
		String reason = request.reason().strip();
		useCase.sendBack(operator.accountId(), now, reason);
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		return decided(actor, operator, AuditAction.USE_CASE_SEND_BACK, useCase, false, reason, now);
	}

	/**
	 * Files a use case under these programs and no others, whatever its status. The organization is not told: it
	 * changes where GenAI Fund features the use case, not what it says.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when there is no such use case, or a program does not exist
	 */
	@Transactional
	public AdminUseCaseResponse setPrograms(Actor actor, UUID id, SetUseCaseProgramsRequest request) {
		Operator operator = identity.requireOperator(actor);
		UseCase useCase = useCases.findForUpdate(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		Map<UUID, ProgramName> named = programsNamed(request.programIds());
		useCase.belongTo(named.keySet());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		audit.record(new AuditRecord(AuditAction.USE_CASE_SET_PROGRAMS,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(), titleOf(useCase)),
				Map.of("organization", useCase.getOrganizationId().toString())));
		Map<UUID, OrganizationName> names = organizations.names(Set.of(useCase.getOrganizationId()));
		return response(actor, useCase, organization(useCase.getOrganizationId(), names), Instant.now());
	}

	private UseCase awaitingReview(UUID id, Instant now) {
		return decidable(id, now, UseCase.IN_REVIEW);
	}

	private UseCase decidable(UUID id, Instant now, String... statuses) {
		UseCase useCase = useCases.findForUpdate(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		if (!List.of(statuses).contains(useCase.statusAt(now))) {
			throw new UseCaseException(UseCaseErrorCode.NOT_AWAITING_REVIEW,
					"Decision on use case " + id + ", which is " + useCase.statusAt(now));
		}
		return useCase;
	}

	/** Records a decision, tells the members of the organization, and reads the use case back. */
	private AdminUseCaseResponse decided(Actor actor, Operator operator, AuditAction action, UseCase useCase,
			boolean approved, @Nullable String reason, Instant now) {
		Map<UUID, OrganizationName> names = organizations.names(Set.of(useCase.getOrganizationId()));
		UseCaseOrganizationResponse organization = organization(useCase.getOrganizationId(), names);
		audit.record(new AuditRecord(action, new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(), titleOf(useCase)),
				Map.of("organization", organization.id().toString())));
		String title = titleOf(useCase);
		for (Person member : identity.people(organizations.memberAccountIds(useCase.getOrganizationId())).values()) {
			try {
				email.sendUseCaseDecision(member.email(), organization.name(), title, approved, reason);
			}
			catch (NotificationException notSent) {
				// The decision stands; EmailService has logged that this member was not told.
				LOG.atWarn().addKeyValue("event", "usecase.decision.member_not_told").log("Member not told");
			}
		}
		return response(actor, useCase, organization, now);
	}

	private static String titleOf(UseCase useCase) {
		return useCase.getTitle() != null ? useCase.getTitle() : "Untitled use case";
	}

	/** A budget is a range in order, or it is to be determined and has no amount. */
	private static void checkBudget(CreateUseCaseRequest request) {
		Long min = request.budgetMin();
		Long max = request.budgetMax();
		if (request.budgetToBeDetermined()) {
			if (min != null || max != null) {
				throw refused(UseCaseErrorCode.BUDGET_INCOMPLETE, "A budget to be determined carries an amount");
			}
			return;
		}
		if (min == null || max == null) {
			throw refused(UseCaseErrorCode.BUDGET_INCOMPLETE, "A budget lacks its minimum or its maximum");
		}
		if (min > max) {
			throw refused(UseCaseErrorCode.BUDGET_OUT_OF_ORDER, "Budget " + min + " to " + max);
		}
	}

	private AdminUseCaseResponse response(Actor actor, UseCase useCase, UseCaseOrganizationResponse organization,
			Instant now) {
		List<UseCaseAttachmentResponse> attachments = files.of(useCase);
		UUID sender = useCase.getSubmittedByAccountId();
		UUID reviewer = useCase.getReviewedByAccountId();
		Set<UUID> accounts = new HashSet<>();
		accounts.add(useCase.getCreatedByAccountId());
		if (sender != null) {
			accounts.add(sender);
		}
		if (reviewer != null) {
			accounts.add(reviewer);
		}
		Map<UUID, UseCasePersonResponse> named = people.of(actor, accounts);
		return new AdminUseCaseResponse(useCase.getId(), organization, useCase.getTitle(), useCase.statusAt(now),
				useCase.getProblemStatement(), useCase.getIndustry(), useCase.getTechnologies(),
				useCase.getExpectedOutcomes(), useCase.getCurrentProcess(), useCase.getCurrentSolutions(),
				useCase.getTargetUsers(),
				useCase.getRequirements()
					.stream()
					.map(requirement -> new UseCaseRequirementEntry(requirement.statement(), requirement.necessity()))
					.toList(),
				useCase.getDataReadiness(), useCase.getIntegrationRequirements(), attachments, useCase.getBudgetMin(),
				useCase.getBudgetMax(), useCase.getCurrency(), useCase.isBudgetToBeDetermined(),
				useCase.isBudgetMembersOnly(),
				useCase.getTimelineMinWeeks(), useCase.getTimelineMaxWeeks(), useCase.isHideOrganizationName(),
				useCase.getPublishedAt(), useCase.getClosesAt(), useCase.getVersion(), useCase.getCreatedAt(),
				useCase.getUpdatedAt(), useCase.getSubmittedAt(), named.get(useCase.getCreatedByAccountId()),
				sender == null ? null : named.get(sender), useCase.getReviewedAt(),
				reviewer == null ? null : named.get(reviewer), useCase.getReviewNote(),
				programs.names(useCase.getProgramIds())
					.values()
					.stream()
					.map(program -> new UseCaseProgramResponse(program.id(), program.name(), program.slug(),
							program.published()))
					.sorted(Comparator.comparing(UseCaseProgramResponse::name))
					.toList());
	}

	/** The programs these identifiers name; one that names none refuses the request. */
	private Map<UUID, ProgramName> programsNamed(List<UUID> ids) {
		Map<UUID, ProgramName> named = programs.names(Set.copyOf(ids));
		if (named.size() != Set.copyOf(ids).size()) {
			throw new UseCaseException(UseCaseErrorCode.PROGRAM_NOT_FOUND,
					"Program among " + ids + " that does not exist");
		}
		return named;
	}

	/** The currency a budget is written in: US dollars unless the request names another. */
	static String currencyOf(@Nullable String currency) {
		return currency == null ? UseCase.USD : currency;
	}

	/** The organization named by its own module; a use case always has one, since the table references it. */
	private static UseCaseOrganizationResponse organization(UUID id, Map<UUID, OrganizationName> names) {
		OrganizationName name = names.get(id);
		return new UseCaseOrganizationResponse(id, name == null ? "" : name.name());
	}

	/** What a person typed, or null when they typed nothing. */
	private static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	private static UseCaseException refused(UseCaseErrorCode code, String diagnostic) {
		return new UseCaseException(code, "Creation of a use case refused: " + diagnostic);
	}

	/**
	 * The use cases waiting for an operator's review, at most this many, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public UseCasesAwaitingReview awaitingReview(Actor actor, int limit) {
		identity.requireOperator(actor);
		Instant now = Instant.now();
		List<UseCaseQueryRepository.Row> rows = useCaseList.page(null, List.of(), null, "in_review", now, limit, 0);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(UseCaseQueryRepository.Row::organizationId).collect(Collectors.toSet()));
		return new UseCasesAwaitingReview(useCaseList.count(null, List.of(), null, "in_review", now), rows.stream()
			.map(row -> new UseCasesAwaitingReview.Item(row.id(), row.title(),
					names.containsKey(row.organizationId()) ? names.get(row.organizationId()).name() : null,
					row.updatedAt()))
			.toList());
	}

}
