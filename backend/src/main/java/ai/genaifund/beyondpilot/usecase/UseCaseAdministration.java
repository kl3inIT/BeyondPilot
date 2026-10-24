package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;

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
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.storage.FileDownload;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseListRequest;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseListResponse;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseResponse;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.dto.CreateUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.SendBackUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.SetUseCaseProgramsRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAccessResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCasePersonResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAttachmentResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationListRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationListResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseProgramResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseRequirementEntry;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseReviewQueueResponse;
import ai.genaifund.beyondpilot.usecase.persistence.AccessRole;
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

	/** The days of a review queue are Vietnam's, as the screens show them. */
	private static final ZoneId QUEUE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

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

	private final Validator validator;

	private final UseCaseAccess access;

	UseCaseAdministration(UseCaseRepository useCases, UseCaseQueryRepository useCaseList,
			OrganizationDirectory organizations, IdentityService identity, AuditTrail audit, UseCaseAttachments files,
			UseCasePeople people, EmailService email, ApplicationEventPublisher events, ProgramService programs,
			Validator validator, UseCaseAccess access) {
		this.access = access;
		this.validator = validator;
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
	 * One page of use cases in any status, in the order the request asks for and the newest first without one, each
	 * as it reads now: closed once its date has passed.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminUseCaseListResponse list(Actor actor, AdminUseCaseListRequest request) {
		identity.requireOperator(actor);
		String text = text(request.q());
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		Instant now = Instant.now();
		List<UUID> matching = text == null ? List.of()
				: organizations.named(text);
		List<UseCaseQueryRepository.Row> rows = useCaseList.page(text, matching, request.organizationId(),
				request.status(), request.featured(), request.sort(), now, size, (long) (page - 1) * size);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(UseCaseQueryRepository.Row::organizationId).collect(Collectors.toSet()));
		List<AdminUseCaseSummaryResponse> items = rows.stream()
			.map(row -> new AdminUseCaseSummaryResponse(row.id(), organization(row.organizationId(), names),
					row.title(), row.status(), row.closesAt(), row.featuredAt(), row.updatedAt()))
			.toList();
		List<UseCaseOrganizationResponse> organizationOptions = organizations.names(useCaseList.organizationIds())
			.values()
			.stream()
			.map(name -> new UseCaseOrganizationResponse(name.id(), name.name(), name.logoFileId()))
			.sorted(Comparator.comparing(UseCaseOrganizationResponse::name, String.CASE_INSENSITIVE_ORDER)
				.thenComparing(UseCaseOrganizationResponse::id))
			.toList();
		return new AdminUseCaseListResponse(items, organizationOptions, page, size,
				useCaseList.count(text, matching, request.organizationId(), request.status(), request.featured(), now),
				useCaseList.inReview(now));
	}

	/**
	 * Use cases as a spreadsheet: every page of the list as the request narrows it, in its order, for GenAI Fund to work
	 * with outside BeyondPilot. The download is recorded.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, AdminUseCaseListRequest request, SpreadsheetFormat format) {
		Operator operator = identity.requireOperator(actor);
		List<AdminUseCaseSummaryResponse> rows = Spreadsheet.everyPage(page -> list(actor,
				new AdminUseCaseListRequest(request.q(), request.status(), request.organizationId(), request.featured(),
						request.sort(), page, Spreadsheet.PAGE_SIZE))
			.items());
		Spreadsheet<AdminUseCaseSummaryResponse> sheet = Spreadsheet.<AdminUseCaseSummaryResponse>of("Use cases")
			.text("Use case", AdminUseCaseSummaryResponse::title)
			.text("Organization", useCase -> useCase.organization().name())
			.label("Status", AdminUseCaseSummaryResponse::status)
			.time("Proposals close at", AdminUseCaseSummaryResponse::closesAt)
			.time("Featured since", AdminUseCaseSummaryResponse::featuredAt)
			.time("Updated at", AdminUseCaseSummaryResponse::updatedAt)
			.text("Identifier", AdminUseCaseSummaryResponse::id);
		SpreadsheetFile file = sheet.write(format, "use-cases", rows,
				Spreadsheet.About.of(operator.label(), Instant.now())
					.narrowedBy("Search", request.q())
					.narrowedBy("Status", request.status())
					.narrowedBy("Organization", request.organizationId())
					.narrowedBy("Featured", request.featured())
					.narrowedBy("Order", request.sort()));
		audit.record(new AuditRecord(AuditAction.USE_CASE_EXPORT,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("use_case_list", "use-cases", "Use cases"),
				Map.of("count", String.valueOf(file.rows()))));
		LOG.atInfo()
			.addKeyValue("event", "use_case.list.exported")
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Use cases exported");
		return file;
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
	 * A file of a use case as an operator reads it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist or names no such file
	 */
	@Transactional(readOnly = true)
	public FileDownload attachment(Actor actor, UUID id, UUID fileId) {
		identity.requireOperator(actor);
		UseCase useCase = useCases.findById(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		return files.open(useCase, fileId);
	}

	/**
	 * The organizations not taken down that can have use cases, by name; at most 50.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public UseCaseOrganizationListResponse organizations(Actor actor, UseCaseOrganizationListRequest request) {
		identity.requireOperator(actor);
		return new UseCaseOrganizationListResponse(organizations.activeOrganizations(request.q(), ORGANIZATION_LIMIT)
			.stream()
			.map(organization -> new UseCaseOrganizationResponse(organization.id(), organization.name(),
					organization.logoFileId()))
			.toList());
	}

	/**
	 * Creates a use case for an organization: a draft its members will edit, or a published one when the operator
	 * asks. An operator's own work needs no review, so nothing is created in review.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the organization is taken down, the close date is not in the
	 * future, or the budget or the timeline is out of order
	 */
	@Transactional
	public AdminUseCaseResponse create(Actor actor, CreateUseCaseRequest request) {
		Created created = created(actor, request, false);
		OrganizationName organization = created.organization();
		return response(actor, created.useCase(),
				new UseCaseOrganizationResponse(organization.id(), organization.name(), organization.logoFileId()),
				Instant.now());
	}

	/**
	 * Creates a draft GenAI Fund keeps private for an organization: only operators see it, until one publishes it
	 * with {@link #publishPrivate}. Nobody is told.
	 * @return the use case's identifier
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException as {@link #create} does
	 * @throws ConstraintViolationException when a field breaks what the admin screen's form allows
	 */
	@Transactional
	public UUID createPrivate(Actor actor, UUID organizationId, PrivateUseCase useCase) {
		return created(actor, valid(request(organizationId, useCase)), true).useCase().getId();
	}

	/**
	 * Replaces what a private draft says. Its files and programs stay as they are. Nobody is told.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when there is no such use case, it is not a private draft, or a check of
	 * {@link #create} fails
	 * @throws ConstraintViolationException when a field breaks what the admin screen's form allows
	 */
	@Transactional
	public void savePrivate(Actor actor, UUID id, PrivateUseCase written) {
		Operator operator = identity.requireOperator(actor);
		UseCase useCase = privateDraft(id);
		CreateUseCaseRequest request = valid(request(useCase.getOrganizationId(), written));
		check(request, Instant.now());
		write(useCase, request);
		useCase.editedBy(operator.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(id));
		record(AuditAction.USE_CASE_UPDATE, operator, useCase);
	}

	/**
	 * Publishes a private draft: from now on it reads as any published use case, to everyone and to its
	 * organization's members. Nobody is emailed, as for a use case an operator publishes when creating it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when there is no such use case, it is not a private draft, or its close date passed
	 */
	@Transactional
	public void publishPrivate(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		UseCase useCase = privateDraft(id);
		Instant now = Instant.now();
		Instant closesAt = useCase.getClosesAt();
		if (closesAt != null && !closesAt.isAfter(now)) {
			throw refused(UseCaseErrorCode.CLOSES_IN_THE_PAST, "Close date " + closesAt + " is not after " + now);
		}
		useCase.publish(now);
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(id));
		record(AuditAction.USE_CASE_PUBLISH, operator, useCase);
	}

	/**
	 * Hides a public use case. It leaves the directory and search; its proposals stay saved, and it can be made public
	 * again at any time. Nobody is emailed.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when there is no such use case, or it is not public
	 */
	@Transactional
	public AdminUseCaseResponse makePrivate(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Instant now = Instant.now();
		UseCase useCase = locked(id);
		if (!UseCase.APPROVED.equals(useCase.statusAt(now))) {
			throw new UseCaseException(UseCaseErrorCode.CANNOT_MAKE_PRIVATE,
					"Use case " + id + " is " + useCase.statusAt(now));
		}
		useCase.makePrivate();
		useCase.editedBy(operator.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(id));
		record(AuditAction.USE_CASE_MAKE_PRIVATE, operator, useCase);
		return read(actor, useCase, now);
	}

	/**
	 * Makes a use case public at once: a private one, a draft or one GenAI Fund sent back. An operator's decision
	 * needs no review, and nobody is emailed. One in review is approved with {@link #approve} instead.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when there is no such use case, it is in review, closed or public already, it lacks a
	 * part a public use case needs, or its close date passed
	 */
	@Transactional
	public AdminUseCaseResponse makePublic(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Instant now = Instant.now();
		UseCase useCase = locked(id);
		String status = useCase.statusAt(now);
		if (!List.of(UseCase.PRIVATE, UseCase.DRAFT, UseCase.NEEDS_CHANGES).contains(status)) {
			throw new UseCaseException(UseCaseErrorCode.CANNOT_MAKE_PUBLIC, "Use case " + id + " is " + status);
		}
		if (!useCase.isPublishable()) {
			throw new UseCaseException(UseCaseErrorCode.INCOMPLETE, "Use case " + id + " lacks a part");
		}
		Instant closesAt = useCase.getClosesAt();
		if (closesAt != null && !closesAt.isAfter(now)) {
			throw refused(UseCaseErrorCode.CLOSES_IN_THE_PAST, "Close date " + closesAt + " is not after " + now);
		}
		if (UseCase.PRIVATE.equals(status)) {
			useCase.makePublic(now);
		}
		else {
			useCase.publish(now);
		}
		useCase.editedBy(operator.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(id));
		record(UseCase.PRIVATE.equals(status) ? AuditAction.USE_CASE_MAKE_PUBLIC : AuditAction.USE_CASE_PUBLISH,
				operator, useCase);
		return read(actor, useCase, now);
	}

	/**
	 * Who may do what with a use case, and which members of its organization could be given access.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist
	 */
	@Transactional(readOnly = true)
	public UseCaseAccessResponse access(Actor actor, UUID id) {
		identity.requireOperator(actor);
		UseCase useCase = useCases.findById(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		return access.read(actor, useCase, AccessRole.FULL_ACCESS);
	}

	/**
	 * Gives a member of the use case's organization a role in it, or changes the one they have.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist, or the person is not a member or is its creator or an
	 * owner
	 */
	@Transactional
	public UseCaseAccessResponse giveAccess(Actor actor, UUID id, UUID accountId, String role) {
		identity.requireOperator(actor);
		UseCase useCase = locked(id);
		access.grant(actor, useCase, accountId, AccessRole.of(role).orElse(AccessRole.VIEWER));
		return access.read(actor, useCase, AccessRole.FULL_ACCESS);
	}

	/**
	 * Takes the role away from a member; what every member may do still applies to them.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist, or the person is its creator or an owner
	 */
	@Transactional
	public UseCaseAccessResponse removeAccess(Actor actor, UUID id, UUID accountId) {
		identity.requireOperator(actor);
		UseCase useCase = locked(id);
		access.revoke(actor, useCase, accountId);
		return access.read(actor, useCase, AccessRole.FULL_ACCESS);
	}

	/**
	 * Sets what every member of the use case's organization may do with it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist
	 */
	@Transactional
	public UseCaseAccessResponse shareWithMembers(Actor actor, UUID id, String role) {
		identity.requireOperator(actor);
		UseCase useCase = locked(id);
		access.shareWithMembers(actor, useCase, AccessRole.of(role).orElse(AccessRole.NONE));
		useCases.saveAndFlush(useCase);
		return access.read(actor, useCase, AccessRole.FULL_ACCESS);
	}

	private UseCase locked(UUID id) {
		return useCases.findForUpdate(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
	}

	/** The use case as an operator reads it now. */
	private AdminUseCaseResponse read(Actor actor, UseCase useCase, Instant now) {
		Map<UUID, OrganizationName> names = organizations.names(Set.of(useCase.getOrganizationId()));
		return response(actor, useCase, organization(useCase.getOrganizationId(), names), now);
	}

	/**
	 * Sends a use case back with what to change, for a caller that is not the admin screen.
	 * @see #sendBack(Actor, UUID, SendBackUseCaseRequest)
	 */
	@Transactional
	public void sendBack(Actor actor, UUID id, String reason) {
		sendBack(actor, id, valid(new SendBackUseCaseRequest(reason)));
	}

	private record Created(UseCase useCase, OrganizationName organization) {
	}

	private Created created(Actor actor, CreateUseCaseRequest request, boolean operatorsOnly) {
		Operator operator = identity.requireOperator(actor);
		Instant now = Instant.now();
		OrganizationName organization = organizations.activeOrganization(request.organizationId())
			.orElseThrow(() -> refused(UseCaseErrorCode.ORGANIZATION_NOT_ELIGIBLE,
					"Organization " + request.organizationId() + " does not exist or is taken down"));
		check(request, now);
		UseCase useCase = new UseCase(organization.id(), operator.accountId(), request.closesAt());
		// An operator writes it for the organization, whose members may all work on it until someone restricts it.
		useCase.shareWithMembers(AccessRole.FULL_ACCESS);
		write(useCase, request);
		useCase.belongTo(programsNamed(request.programIds() == null ? List.of() : request.programIds()).keySet());
		List<UUID> attachments = request.attachmentFileIds() == null ? List.of() : request.attachmentFileIds();
		files.requireUsable(actor, attachments, List.of());
		useCase.attach(attachments);
		if (operatorsOnly) {
			useCase.keepFromMembers();
		}
		else if (request.publishNow()) {
			useCase.publish(now);
		}
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		audit.record(new AuditRecord(AuditAction.USE_CASE_CREATE,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(), useCase.getTitle()),
				Map.of("organization", organization.id().toString(), "status",
						operatorsOnly ? "private" : useCase.getStatus())));
		return new Created(useCase, organization);
	}

	/** The close date, the budget and the timeline of what an operator wrote, as the form checks them. */
	private static void check(CreateUseCaseRequest request, Instant now) {
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
	}

	/** Writes what an operator wrote into the use case; its files and programs are set apart. */
	private static void write(UseCase useCase, CreateUseCaseRequest request) {
		// An operator may leave out what a brief does not say; only a member's own submission needs every part.
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
		useCase.takeWeeks(request.timelineMinWeeks(), request.timelineMaxWeeks());
		useCase.closeAt(request.closesAt());
		useCase.showCompanyName(request.hideOrganizationName());
		if (request.proposalEditDays() != null) {
			useCase.allowProposalEdits(request.proposalEditDays());
		}
	}

	/** The form's request for what a caller other than the admin screen wrote, saved as a draft. */
	private static CreateUseCaseRequest request(UUID organizationId, PrivateUseCase written) {
		return new CreateUseCaseRequest(organizationId, written.title(), written.problemStatement(), written.industry(),
				written.technologies(), written.expectedOutcomes(), written.currentProcess(),
				written.currentSolutions(), written.targetUsers(),
				written.requirements()
					.stream()
					.map(requirement -> new UseCaseRequirementEntry(requirement.statement(),
							requirement.required() ? "required" : "optional"))
					.toList(),
				written.dataReadiness(), written.integrationRequirements(), List.of(), written.currency(),
				written.budgetMin(), written.budgetMax(), written.budgetToBeDetermined(), written.budgetMembersOnly(),
				written.timelineMinWeeks(), written.timelineMaxWeeks(), written.closesAt(), null,
				written.hideOrganizationName(), false, List.of());
	}

	/** The request, when it holds what the admin screen's form allows. */
	private <T> T valid(T request) {
		Set<ConstraintViolation<T>> violations = validator.validate(request);
		if (!violations.isEmpty()) {
			throw new ConstraintViolationException(violations);
		}
		return request;
	}

	private UseCase privateDraft(UUID id) {
		UseCase useCase = useCases.findForUpdate(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		if (!useCase.isOperatorsOnly()) {
			throw new UseCaseException(UseCaseErrorCode.NOT_PRIVATE, "Use case " + id + " is not a private draft");
		}
		return useCase;
	}

	private void record(AuditAction action, Operator operator, UseCase useCase) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(), titleOf(useCase)),
				Map.of("organization", useCase.getOrganizationId().toString())));
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

	/**
	 * Files a use case under these programs and no others, for a caller that is not the admin screen.
	 * @see #setPrograms(Actor, UUID, SetUseCaseProgramsRequest)
	 */
	@Transactional
	public void setPrograms(Actor actor, UUID id, List<UUID> programIds) {
		setPrograms(actor, id, valid(new SetUseCaseProgramsRequest(programIds)));
	}

	/**
	 * Features a use case: it comes first in the opening view of the public list, where the reader has searched
	 * for nothing, chosen no filter and reads the newest first, the earliest featured on top; its card says Featured
	 * wherever the list shows it. Any use case can be featured, whatever its status; one that is closed or not published stays out of the public list all the same. A use case keeps being featured through every decision, so one
	 * featured before it is public comes first from the moment it is. Featuring one that is featured already changes
	 * nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist
	 */
	@Transactional
	public void feature(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		UseCase useCase = useCases.findById(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		if (useCases.feature(id, Instant.now()) == 1) {
			recordFeatured(AuditAction.USE_CASE_FEATURE, operator, useCase);
		}
	}

	/**
	 * Stops featuring a use case, which goes back to its place among the others. On one that is not featured it changes
	 * nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist
	 */
	@Transactional
	public void unfeature(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		UseCase useCase = useCases.findById(id)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id));
		if (useCases.unfeature(id) == 1) {
			recordFeatured(AuditAction.USE_CASE_UNFEATURE, operator, useCase);
		}
	}

	private void recordFeatured(AuditAction action, Operator operator, UseCase useCase) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(), titleOf(useCase)),
				Map.of("organization", useCase.getOrganizationId().toString())));
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
				email.sendUseCaseDecision(member.email(), organization.name(), title, approved, reason,
						useCase.getId());
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
				useCase.getTimelineMinWeeks(), useCase.getTimelineMaxWeeks(), useCase.getProposalEditDays(),
				useCase.isHideOrganizationName(),
				useCase.getPublishedAt(), useCase.getClosesAt(), useCase.getFeaturedAt(), useCase.getVersion(),
				useCase.getCreatedAt(),
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
		return new UseCaseOrganizationResponse(id, name == null ? "" : name.name(),
				name == null ? null : name.logoFileId());
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
		List<UseCaseQueryRepository.Row> rows = useCaseList.page(null, List.of(), null, "in_review", null, null, now, limit,
				0);
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(UseCaseQueryRepository.Row::organizationId).collect(Collectors.toSet()));
		return new UseCasesAwaitingReview(useCaseList.count(null, List.of(), null, "in_review", null, now), rows.stream()
			.map(row -> new UseCasesAwaitingReview.Item(row.id(), row.title(),
					names.containsKey(row.organizationId()) ? names.get(row.organizationId()).name() : null,
					row.updatedAt()))
			.toList());
	}

	/**
	 * One page of the operators' list of use cases, in its own order, for the MCP server.
	 * @param status one of the list's statuses, or null for every one
	 * @param q only use cases whose title or organization name contains it; every one when null
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public UseCaseReviewList reviewList(Actor actor, @Nullable String status, @Nullable String q, int page, int size) {
		AdminUseCaseListResponse found = list(actor, new AdminUseCaseListRequest(q, status, null, null, null, page, size));
		return new UseCaseReviewList(found.total(), found.items()
			.stream()
			.map(item -> new UseCaseReviewList.Item(item.id(), item.title(), item.organization().name(),
					item.status(), item.closesAt(), item.featuredAt(), item.updatedAt()))
			.toList());
	}

	/**
	 * One use case as its admin page shows it, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws UseCaseException when the use case does not exist
	 */
	@Transactional(readOnly = true)
	public UseCaseReviewRecord reviewRecord(Actor actor, UUID id) {
		AdminUseCaseResponse found = get(actor, id);
		UseCasePersonResponse submittedBy = found.submittedBy();
		UseCasePersonResponse reviewedBy = found.reviewedBy();
		return new UseCaseReviewRecord(found.id(), found.organization().id(), found.organization().name(),
				found.title(), found.status(), found.problemStatement(), found.industry(), found.technologies(),
				found.expectedOutcomes(), found.currentProcess(), found.currentSolutions(), found.targetUsers(),
				found.requirements()
					.stream()
					.map(requirement -> new UseCaseReviewRecord.Requirement(requirement.statement(),
							requirement.necessity()))
					.toList(),
				found.dataReadiness(), found.integrationRequirements(),
				found.attachments().stream().map(UseCaseAttachmentResponse::fileName).toList(), found.budgetMin(),
				found.budgetMax(), found.currency(), found.budgetToBeDetermined(), found.budgetMembersOnly(),
				found.timelineMinWeeks(), found.timelineMaxWeeks(), found.hideOrganizationName(),
				found.programs().stream().map(UseCaseProgramResponse::name).toList(), found.publishedAt(),
				found.closesAt(), found.featuredAt(), found.createdAt(), found.createdBy().name(),
				found.submittedAt(), submittedBy == null ? null : submittedBy.name(), found.reviewedAt(),
				reviewedBy == null ? null : reviewedBy.name(), found.reviewNote(), found.updatedAt(),
				useCases.findById(id).map(UseCase::isOperatorsOnly).orElse(false));
	}

	/**
	 * How many use cases wait for review now, since when the oldest has waited, and how many
	 * waited at the end of each of the last 14 days, for the admin home.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public UseCaseReviewQueueResponse queue(Actor actor) {
		identity.requireOperator(actor);
		LocalDate today = LocalDate.now(QUEUE_ZONE);
		List<Long> days = useCaseList.useCasesWaitingByDay(today, Instant.now());
		return new UseCaseReviewQueueResponse(days.getLast(), useCaseList.useCasesOldestWaiting(),
				today.minusDays(days.size() - 1L), days);
	}

}
