package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCaseResponse;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCasesResponse;
import ai.genaifund.beyondpilot.usecase.dto.SaveMyUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCasePersonResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseRequirementEntry;
import ai.genaifund.beyondpilot.usecase.persistence.UseCase;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRepository;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRequirement;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What the members of an organization do with its use cases: read them, write a draft step by step, send it to GenAI
 * Fund, and take it back. Every member of an approved organization that publishes use cases may do all of it; nobody
 * outside the organization may do any of it, and a use case of another organization is answered as not found.
 */
@Service
public class UseCaseService {

	private static final String USE_CASE = "use_case";

	private final UseCaseRepository useCases;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final UseCaseAttachments files;

	private final UseCasePeople people;

	private final ApplicationEventPublisher events;

	UseCaseService(UseCaseRepository useCases, OrganizationDirectory organizations, IdentityService identity,
			AuditTrail audit, UseCaseAttachments files, UseCasePeople people, ApplicationEventPublisher events) {
		this.events = events;
		this.useCases = useCases;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
		this.files = files;
		this.people = people;
	}

	/**
	 * The use cases of the caller's organization, the most recently touched first.
	 * @throws UseCaseException when the caller is not a member of an approved organization that publishes use cases
	 */
	@Transactional(readOnly = true)
	public MyUseCasesResponse mine(Actor actor) {
		Membership membership = writer(actor);
		Instant now = Instant.now();
		List<UseCase> own = useCases.findByOrganizationIdOrderByUpdatedAtDescIdAsc(membership.organizationId());
		People people = people(actor, own);
		return new MyUseCasesResponse(own.stream()
			.map(useCase -> new MyUseCaseSummaryResponse(useCase.getId(), useCase.getTitle(), useCase.statusAt(now),
					useCase.getClosesAt(), useCase.getSubmittedAt(), people.of(useCase.getLastEditedByAccountId()),
					useCase.getUpdatedAt()))
			.toList());
	}

	/**
	 * One use case of the caller's organization.
	 * @throws UseCaseException when the caller is not a member of such an organization, or there is no such use case
	 * in it
	 */
	@Transactional(readOnly = true)
	public MyUseCaseResponse get(Actor actor, UUID id) {
		Membership membership = writer(actor);
		UseCase useCase = useCases.findById(id)
			.filter(found -> found.getOrganizationId().equals(membership.organizationId()))
			.orElseThrow(() -> notFound(id));
		return response(actor, membership, useCase);
	}

	/**
	 * Starts an empty draft for the caller's organization. It is named and filled in by saving it.
	 * @throws UseCaseException when the caller is not a member of an approved organization that publishes use cases
	 */
	@Transactional
	public MyUseCaseResponse create(Actor actor) {
		Membership membership = writer(actor);
		UseCase useCase = useCases.saveAndFlush(new UseCase(membership.organizationId(), actor.accountId()));
		return response(actor, membership, useCase);
	}

	/**
	 * Saves what the members have written. A draft, or a use case GenAI Fund sent back, stays what it is. A published
	 * use case becomes a draft with the first save, so it leaves the directory until it is sent and approved again.
	 * @throws UseCaseException when the use case is in review or closed, the caller read an older version, or a part
	 * is not valid
	 */
	@Transactional
	public MyUseCaseResponse save(Actor actor, UUID id, SaveMyUseCaseRequest request) {
		Membership membership = writer(actor);
		UseCase useCase = own(membership, id);
		Instant now = Instant.now();
		if (request.version() != useCase.getVersion()) {
			throw new UseCaseException(UseCaseErrorCode.CHANGED_MEANWHILE,
					"Use case " + id + " is at version " + useCase.getVersion() + ", not " + request.version());
		}
		String status = useCase.statusAt(now);
		if (UseCase.IN_REVIEW.equals(status) || UseCase.CLOSED.equals(status)) {
			throw new UseCaseException(UseCaseErrorCode.NOT_EDITABLE, "Use case " + id + " is " + status);
		}
		checkBudget(request);
		checkTimeline(request);
		Instant closesAt = request.closesAt();
		if (closesAt != null && !closesAt.equals(useCase.getClosesAt()) && !closesAt.isAfter(now)) {
			throw new UseCaseException(UseCaseErrorCode.CLOSES_IN_THE_PAST,
					"Close date " + closesAt + " is not after " + now);
		}
		files.requireUsable(actor, request.attachmentFileIds(), useCase.getAttachmentFileIds());

		if (UseCase.APPROVED.equals(status)) {
			useCase.backToDraft();
		}
		useCase.describe(text(request.title()), text(request.problemStatement()), request.industry(),
				request.technologies().stream().distinct().toList());
		useCase.explain(text(request.expectedOutcomes()), text(request.currentProcess()),
				text(request.currentSolutions()), text(request.targetUsers()));
		useCase.specify(request.requirements()
			.stream()
			.map(requirement -> new UseCaseRequirement(requirement.statement().strip(), requirement.necessity()))
			.toList(), text(request.dataReadiness()), text(request.integrationRequirements()));
		useCase.attach(request.attachmentFileIds());
		if (UseCase.NEEDS_CHANGES.equals(status)) {
			useCase.changedAfterReview();
		}
		// A save that names no currency keeps the one stored, so the amounts never change meaning.
		String currency = request.currency() == null ? useCase.getCurrency()
				: UseCaseAdministration.currencyOf(request.currency());
		if (request.budgetToBeDetermined()) {
			useCase.budget(currency, null, null, true, request.budgetMembersOnly());
		}
		else {
			useCase.budget(currency, request.budgetMin(), request.budgetMax(), false, request.budgetMembersOnly());
		}
		useCase.takeWeeks(request.timelineMinWeeks(), request.timelineMaxWeeks());
		useCase.closeAt(closesAt);
		useCase.showCompanyName(request.hideOrganizationName());
		useCase.editedBy(actor.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		return response(actor, membership, useCase);
	}

	/**
	 * Sends a draft, or a use case GenAI Fund sent back, for review. From then on the organization cannot edit it
	 * unless it takes it back.
	 * @throws UseCaseException when the use case is not a draft, lacks a part, or its close date has passed
	 */
	@Transactional
	public MyUseCaseResponse submit(Actor actor, UUID id) {
		Membership membership = writer(actor);
		UseCase useCase = own(membership, id);
		Instant now = Instant.now();
		String status = useCase.statusAt(now);
		if (!UseCase.DRAFT.equals(status) && !UseCase.NEEDS_CHANGES.equals(status)) {
			throw new UseCaseException(UseCaseErrorCode.NOT_SUBMITTABLE, "Use case " + id + " is " + status);
		}
		if (!useCase.isComplete()) {
			throw new UseCaseException(UseCaseErrorCode.INCOMPLETE, "Use case " + id + " lacks a part");
		}
		if (UseCase.NEEDS_CHANGES.equals(status) && !useCase.isChangedSinceReview()) {
			throw new UseCaseException(UseCaseErrorCode.NOT_CHANGED, "Use case " + id + " was not changed since it was sent back");
		}
		useCase.submit(actor.accountId(), now);
		useCase.editedBy(actor.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		record(AuditAction.USE_CASE_SUBMIT, actor, useCase, Map.of("organization", membership.organizationId().toString()));
		return response(actor, membership, useCase);
	}

	/**
	 * Takes a use case out of review, or out of the directory, back to a draft the members can edit.
	 * @throws UseCaseException when the use case is neither in review nor published
	 */
	@Transactional
	public MyUseCaseResponse backToDraft(Actor actor, UUID id) {
		Membership membership = writer(actor);
		UseCase useCase = own(membership, id);
		String status = useCase.statusAt(Instant.now());
		if (!UseCase.IN_REVIEW.equals(status) && !UseCase.APPROVED.equals(status)) {
			throw new UseCaseException(UseCaseErrorCode.CANNOT_MOVE_TO_DRAFT, "Use case " + id + " is " + status);
		}
		useCase.backToDraft();
		useCase.editedBy(actor.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		record(AuditAction.USE_CASE_DRAFT, actor, useCase,
				Map.of("organization", membership.organizationId().toString(), "from", status));
		return response(actor, membership, useCase);
	}

	/** The caller's organization, which must be approved. */
	private Membership writer(Actor actor) {
		identity.requireActive(actor);
		return organizations.membershipOf(actor)
			.filter(Membership::approved)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.ENTERPRISE_REQUIRED,
					"Account " + actor.accountId() + " is not a member of an approved organization"));
	}

	/** One use case of the caller's organization, locked for the change about to be made. */
	private UseCase own(Membership membership, UUID id) {
		return useCases.findForUpdate(id)
			.filter(found -> found.getOrganizationId().equals(membership.organizationId()))
			.orElseThrow(() -> notFound(id));
	}

	private static UseCaseException notFound(UUID id) {
		return new UseCaseException(UseCaseErrorCode.NOT_FOUND, "No use case " + id + " for this caller");
	}

	private void record(AuditAction action, Actor actor, UseCase useCase, Map<String, String> details) {
		Person person = identity.person(actor);
		audit.record(new AuditRecord(action, new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(USE_CASE, useCase.getId().toString(),
						useCase.getTitle() != null ? useCase.getTitle() : "Untitled use case"), details));
	}

	private static void checkBudget(SaveMyUseCaseRequest request) {
		Long min = request.budgetMin();
		Long max = request.budgetMax();
		if (request.budgetToBeDetermined()) {
			return;
		}
		if ((min == null) != (max == null)) {
			throw new UseCaseException(UseCaseErrorCode.BUDGET_INCOMPLETE, "A budget lacks its minimum or its maximum");
		}
		if (min != null && max != null && min > max) {
			throw new UseCaseException(UseCaseErrorCode.BUDGET_OUT_OF_ORDER, "Budget " + min + " to " + max);
		}
	}

	private static void checkTimeline(SaveMyUseCaseRequest request) {
		Integer min = request.timelineMinWeeks();
		Integer max = request.timelineMaxWeeks();
		if (min != null && max != null && min > max) {
			throw new UseCaseException(UseCaseErrorCode.TIMELINE_OUT_OF_ORDER, "Timeline " + min + " to " + max + " weeks");
		}
	}

	/** What a person typed, or null when they typed nothing. */
	private static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	private MyUseCaseResponse response(Actor actor, Membership membership, UseCase useCase) {
		Instant now = Instant.now();
		String status = useCase.statusAt(now);
		People people = people(actor, List.of(useCase));
		UUID sender = useCase.getSubmittedByAccountId();
		return new MyUseCaseResponse(useCase.getId(), membership.organizationName(), status,
				UseCase.DRAFT.equals(status) || UseCase.NEEDS_CHANGES.equals(status) || UseCase.APPROVED.equals(status),
				useCase.isComplete(), useCase.getTitle(), useCase.getProblemStatement(), useCase.getIndustry(),
				useCase.getTechnologies(), useCase.getExpectedOutcomes(), useCase.getCurrentProcess(),
				useCase.getCurrentSolutions(), useCase.getTargetUsers(),
				useCase.getRequirements()
					.stream()
					.map(requirement -> new UseCaseRequirementEntry(requirement.statement(), requirement.necessity()))
					.toList(),
				useCase.getDataReadiness(), useCase.getIntegrationRequirements(), files.of(useCase),
				useCase.getBudgetMin(), useCase.getBudgetMax(), useCase.getCurrency(), useCase.isBudgetToBeDetermined(),
				useCase.isBudgetMembersOnly(), useCase.getTimelineMinWeeks(), useCase.getTimelineMaxWeeks(),
				useCase.isHideOrganizationName(), useCase.getClosesAt(), useCase.getPublishedAt(),
				useCase.getSubmittedAt(), sender == null ? null : people.of(sender), useCase.getReviewNote(),
				useCase.isChangedSinceReview(), people.of(useCase.getLastEditedByAccountId()), useCase.getVersion(), useCase.getUpdatedAt());
	}

	/** The people who last changed or sent the given use cases, named for the caller. */
	private People people(Actor actor, List<UseCase> of) {
		Set<UUID> ids = new HashSet<>();
		for (UseCase useCase : of) {
			ids.add(useCase.getLastEditedByAccountId());
			if (useCase.getSubmittedByAccountId() != null) {
				ids.add(useCase.getSubmittedByAccountId());
			}
		}
		Map<UUID, UseCasePersonResponse> byId = people.of(actor, ids);
		return new People(byId);
	}

	private record People(Map<UUID, UseCasePersonResponse> byId) {

		UseCasePersonResponse of(UUID accountId) {
			UseCasePersonResponse person = byId.get(accountId);
			return person != null ? person : new UseCasePersonResponse("", false, false);
		}
	}
}
