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
import ai.genaifund.beyondpilot.storage.FileDownload;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCaseResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAccessResponse;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCaseSummaryResponse;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCasesResponse;
import ai.genaifund.beyondpilot.usecase.dto.SaveMyUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCasePersonResponse;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseRequirementEntry;
import ai.genaifund.beyondpilot.usecase.persistence.AccessRole;
import ai.genaifund.beyondpilot.usecase.persistence.UseCase;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRepository;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRequirement;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What the members of an organization do with its use cases: read them, write a draft step by step, send it to GenAI
 * Fund, and take it back. Every member of an organization that is not taken down and publishes use cases may do all of it; nobody
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

	private final UseCaseAccess access;

	UseCaseService(UseCaseRepository useCases, OrganizationDirectory organizations, IdentityService identity,
			AuditTrail audit, UseCaseAttachments files, UseCasePeople people, ApplicationEventPublisher events,
			UseCaseAccess access) {
		this.events = events;
		this.access = access;
		this.useCases = useCases;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
		this.files = files;
		this.people = people;
	}

	/**
	 * The use cases of the caller's organization, the most recently touched first.
	 * @throws UseCaseException when the caller is not a member of an organization that is not taken down and publishes use cases
	 */
	@Transactional(readOnly = true)
	public MyUseCasesResponse mine(Actor actor) {
		Membership membership = writer(actor);
		Instant now = Instant.now();
		Map<UUID, AccessRole> given = access.givenTo(actor);
		Map<UUID, AccessRole> roles = new HashMap<>();
		List<UseCase> own = useCases.findByOrganizationIdOrderByUpdatedAtDescIdAsc(membership.organizationId())
			.stream()
			.filter(UseCaseService::seenByMembers)
			.filter(useCase -> {
				AccessRole role = access.roleOf(actor, membership, useCase,
						given.getOrDefault(useCase.getId(), AccessRole.NONE));
				roles.put(useCase.getId(), role);
				return role != AccessRole.NONE;
			})
			.toList();
		People people = people(actor, own);
		return new MyUseCasesResponse(own.stream()
			.map(useCase -> new MyUseCaseSummaryResponse(useCase.getId(), useCase.getTitle(), useCase.statusAt(now),
					roles.get(useCase.getId()).code(), useCase.getClosesAt(), useCase.getSubmittedAt(),
					people.of(useCase.getLastEditedByAccountId()), useCase.getUpdatedAt()))
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
		UseCase useCase = readable(actor, membership, id);
		return response(actor, membership, useCase);
	}

	/**
	 * A file of a use case of the caller's organization.
	 * @throws UseCaseException when the caller is not a member of such an organization, or its use case names no such file
	 */
	@Transactional(readOnly = true)
	public FileDownload attachment(Actor actor, UUID id, UUID fileId) {
		Membership membership = writer(actor);
		UseCase useCase = readable(actor, membership, id);
		return files.open(useCase, fileId);
	}

	/**
	 * Starts an empty draft for the caller's organization. It is named and filled in by saving it.
	 * @throws UseCaseException when the caller is not a member of an organization that is not taken down and publishes use cases
	 */
	@Transactional
	public MyUseCaseResponse create(Actor actor) {
		Membership membership = writer(actor);
		UseCase useCase = useCases.saveAndFlush(new UseCase(membership.organizationId(), actor.accountId()));
		return response(actor, membership, useCase);
	}

	/**
	 * Saves what the members have written. A draft, a use case GenAI Fund sent back, a private one and a public one
	 * stay what they are: GenAI Fund reviews a use case once, before it first goes public, and an edit after that takes
	 * effect at once.
	 * @throws UseCaseException when the use case is in review or closed, the caller read an older version, a part
	 * is not valid, or a use case GenAI Fund approved would lack a part
	 */
	@Transactional
	public MyUseCaseResponse save(Actor actor, UUID id, SaveMyUseCaseRequest request) {
		Membership membership = writer(actor);
		UseCase useCase = own(actor, membership, id, AccessRole.EDITOR);
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
		if ((UseCase.APPROVED.equals(status) || UseCase.PRIVATE.equals(status)) && !useCase.isComplete()) {
			// GenAI Fund approved it whole. An edit takes effect at once, so it may not take a part away.
			throw new UseCaseException(UseCaseErrorCode.INCOMPLETE, "Use case " + id + " would lack a part once saved");
		}
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
		UseCase useCase = own(actor, membership, id, AccessRole.FULL_ACCESS);
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
	 * Takes a use case out of review, back to a draft the members can edit.
	 * @throws UseCaseException when the use case is not in review
	 */
	@Transactional
	public MyUseCaseResponse backToDraft(Actor actor, UUID id) {
		Membership membership = writer(actor);
		UseCase useCase = own(actor, membership, id, AccessRole.FULL_ACCESS);
		String status = useCase.statusAt(Instant.now());
		if (!UseCase.IN_REVIEW.equals(status)) {
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

	/**
	 * Hides a public use case from the directory, search and the public page. Its proposals stay saved, and it can be
	 * made public again at any time with no new review.
	 * @throws UseCaseException when the use case is not public
	 */
	@Transactional
	public MyUseCaseResponse makePrivate(Actor actor, UUID id) {
		Membership membership = writer(actor);
		UseCase useCase = own(actor, membership, id, AccessRole.FULL_ACCESS);
		String status = useCase.statusAt(Instant.now());
		if (!UseCase.APPROVED.equals(status)) {
			throw new UseCaseException(UseCaseErrorCode.CANNOT_MAKE_PRIVATE, "Use case " + id + " is " + status);
		}
		useCase.makePrivate();
		useCase.editedBy(actor.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		record(AuditAction.USE_CASE_MAKE_PRIVATE, actor, useCase,
				Map.of("organization", membership.organizationId().toString()));
		return response(actor, membership, useCase);
	}

	/**
	 * Makes a private use case public again. GenAI Fund approved it before, so nobody reviews it again.
	 * @throws UseCaseException when the use case is not private, or its close date has passed
	 */
	@Transactional
	public MyUseCaseResponse makePublic(Actor actor, UUID id) {
		Membership membership = writer(actor);
		UseCase useCase = own(actor, membership, id, AccessRole.FULL_ACCESS);
		Instant now = Instant.now();
		String status = useCase.statusAt(now);
		if (!UseCase.PRIVATE.equals(status)) {
			throw new UseCaseException(UseCaseErrorCode.CANNOT_MAKE_PUBLIC, "Use case " + id + " is " + status);
		}
		useCase.makePublic(now);
		useCase.editedBy(actor.accountId());
		useCases.saveAndFlush(useCase);
		events.publishEvent(new UseCaseChanged(useCase.getId()));
		record(AuditAction.USE_CASE_MAKE_PUBLIC, actor, useCase,
				Map.of("organization", membership.organizationId().toString()));
		return response(actor, membership, useCase);
	}

	/**
	 * Who may do what with one use case of the caller's organization, and who could be given access.
	 * @throws UseCaseException when the caller may not see the use case
	 */
	@Transactional(readOnly = true)
	public UseCaseAccessResponse access(Actor actor, UUID id) {
		Membership membership = writer(actor);
		UseCase useCase = readable(actor, membership, id);
		return access.read(actor, useCase, access.roleOf(actor, membership, useCase));
	}

	/**
	 * Gives a member of the organization a role in the use case, or changes the one they have.
	 * @throws UseCaseException when the caller lacks full access, or the person is not a member or is the creator or an
	 * owner
	 */
	@Transactional
	public UseCaseAccessResponse giveAccess(Actor actor, UUID id, UUID accountId, String role) {
		Membership membership = writer(actor);
		UseCase useCase = own(actor, membership, id, AccessRole.FULL_ACCESS);
		access.grant(actor, useCase, accountId, AccessRole.of(role).orElse(AccessRole.VIEWER));
		return access.read(actor, useCase, AccessRole.FULL_ACCESS);
	}

	/**
	 * Takes the role away from a member; what every member may do still applies to them.
	 * @throws UseCaseException when the caller lacks full access, or the person is the creator or an owner
	 */
	@Transactional
	public UseCaseAccessResponse removeAccess(Actor actor, UUID id, UUID accountId) {
		Membership membership = writer(actor);
		UseCase useCase = own(actor, membership, id, AccessRole.FULL_ACCESS);
		access.revoke(actor, useCase, accountId);
		return access.read(actor, useCase, AccessRole.FULL_ACCESS);
	}

	/**
	 * Sets what every other member of the organization may do with the use case.
	 * @throws UseCaseException when the caller lacks full access
	 */
	@Transactional
	public UseCaseAccessResponse shareWithMembers(Actor actor, UUID id, String role) {
		Membership membership = writer(actor);
		UseCase useCase = own(actor, membership, id, AccessRole.FULL_ACCESS);
		access.shareWithMembers(actor, useCase, AccessRole.of(role).orElse(AccessRole.NONE));
		useCases.saveAndFlush(useCase);
		return access.read(actor, useCase, AccessRole.FULL_ACCESS);
	}

	/** The caller's organization, which must not be taken down. */
	private Membership writer(Actor actor) {
		identity.requireActive(actor);
		return organizations.membershipOf(actor)
			.filter(Membership::active)
			.orElseThrow(() -> new UseCaseException(UseCaseErrorCode.ENTERPRISE_REQUIRED,
					"Account " + actor.accountId() + " is not a member of an organization that is not taken down"));
	}

	/** One use case the caller may see, of their organization. Another person's is answered as not found. */
	private UseCase readable(Actor actor, Membership membership, UUID id) {
		UseCase useCase = useCases.findById(id)
			.filter(found -> found.getOrganizationId().equals(membership.organizationId()))
			.filter(UseCaseService::seenByMembers)
			.orElseThrow(() -> notFound(id));
		if (access.roleOf(actor, membership, useCase) == AccessRole.NONE) {
			throw notFound(id);
		}
		return useCase;
	}

	/**
	 * One use case of the caller's organization, locked for the change about to be made, when the caller's role allows
	 * it. A use case the caller may not see is answered as not found; one they may see but not change is refused.
	 */
	private UseCase own(Actor actor, Membership membership, UUID id, AccessRole needed) {
		UseCase useCase = useCases.findForUpdate(id)
			.filter(found -> found.getOrganizationId().equals(membership.organizationId()))
			.filter(UseCaseService::seenByMembers)
			.orElseThrow(() -> notFound(id));
		AccessRole role = access.roleOf(actor, membership, useCase);
		if (role == AccessRole.NONE) {
			throw notFound(id);
		}
		if (!role.atLeast(needed)) {
			throw new UseCaseException(UseCaseErrorCode.ACCESS_REQUIRED,
					"Use case " + id + " needs " + needed.code() + " access, the caller has " + role.code());
		}
		return useCase;
	}

	/** A draft GenAI Fund keeps private is not its members' until it is published (BEY-232). */
	private static boolean seenByMembers(UseCase useCase) {
		return !useCase.isOperatorsOnly();
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
		AccessRole role = access.roleOf(actor, membership, useCase);
		People people = people(actor, List.of(useCase));
		UUID sender = useCase.getSubmittedByAccountId();
		return new MyUseCaseResponse(useCase.getId(), membership.organizationName(), status,
				role.atLeast(AccessRole.EDITOR) && (UseCase.DRAFT.equals(status) || UseCase.NEEDS_CHANGES.equals(status)
						|| UseCase.APPROVED.equals(status) || UseCase.PRIVATE.equals(status)),
				role.code(),
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
