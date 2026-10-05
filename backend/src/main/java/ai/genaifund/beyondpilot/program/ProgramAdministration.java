package ai.genaifund.beyondpilot.program;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.program.dto.AdminProgramListResponse;
import ai.genaifund.beyondpilot.program.dto.AdminProgramResponse;
import ai.genaifund.beyondpilot.program.dto.CreateProgramRequest;
import ai.genaifund.beyondpilot.program.dto.ProgramApplications;
import ai.genaifund.beyondpilot.program.dto.ProgramEventEntry;
import ai.genaifund.beyondpilot.program.dto.ProgramKeyDate;
import ai.genaifund.beyondpilot.program.dto.SaveProgramRequest;
import ai.genaifund.beyondpilot.program.persistence.PageKind;
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramEvent;
import ai.genaifund.beyondpilot.program.persistence.ProgramMilestone;
import ai.genaifund.beyondpilot.program.persistence.ProgramQueryRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramType;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageException;
import ai.genaifund.beyondpilot.storage.StorageService;
import org.hibernate.exception.ConstraintViolationException;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with programs. Every operation first checks that the caller is an operator now, and every change
 * is recorded in the audit trail in the transaction of the change.
 */
@Service
public class ProgramAdministration {

	private static final String PROGRAM = "program";

	private static final String SLUG_KEY = "program_slug_key";

	private static final String COVER_KEY = "program_cover_file_id_key";

	/** Programs are run from Vietnam: a day an operator names is a day there. */
	private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

	private final ProgramRepository programs;

	private final ProgramQueryRepository programList;

	private final IdentityService identity;

	private final StorageService storage;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	ProgramAdministration(ProgramRepository programs, ProgramQueryRepository programList, IdentityService identity,
			StorageService storage, AuditTrail audit, ApplicationEventPublisher events) {
		this.programs = programs;
		this.programList = programList;
		this.identity = identity;
		this.storage = storage;
		this.audit = audit;
		this.events = events;
	}

	/**
	 * Every program in any status, the newest first.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminProgramListResponse list(Actor actor) {
		identity.requireOperator(actor);
		return new AdminProgramListResponse(programList.all());
	}

	/**
	 * One program as an operator edits it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when the program does not exist
	 */
	@Transactional(readOnly = true)
	public AdminProgramResponse get(Actor actor, UUID id) {
		identity.requireOperator(actor);
		return response(programs.findById(id).orElseThrow(() -> notFound(id)));
	}

	/**
	 * Creates a draft, which only operators see until it is published.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when another program has the address
	 */
	@Transactional
	public AdminProgramResponse create(Actor actor, CreateProgramRequest request) {
		Operator operator = identity.requireOperator(actor);
		if (programs.existsBySlug(request.slug())) {
			throw slugTaken(request.slug(), null);
		}
		Program program;
		try {
			program = programs.saveAndFlush(
					new Program(request.slug(), request.name().strip(), ProgramType.of(request.type())));
		}
		catch (DataIntegrityViolationException raced) {
			// Two operators created the same address at the same moment; the unique constraint decided.
			if (SLUG_KEY.equals(constraint(raced))) {
				throw slugTaken(request.slug(), raced);
			}
			throw raced;
		}
		record(AuditAction.PROGRAM_CREATE, operator, program);
		return response(program);
	}

	/**
	 * Saves a program as the Settings screen holds it: its details, its application window, its key dates and its
	 * events together, or nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when the program does not exist, it changed since the screen read it, its address is
	 * taken or fixed, its dates are out of order, or its cover is not a stored image of the caller
	 */
	@Transactional
	public AdminProgramResponse save(Actor actor, UUID id, SaveProgramRequest request) {
		Operator operator = identity.requireOperator(actor);
		Program program = programs.findForUpdate(id).orElseThrow(() -> notFound(id));
		if (program.getVersion() != request.version()) {
			throw new ProgramException(ProgramErrorCode.CHANGED_MEANWHILE, "Save of program " + id + " at version "
					+ request.version() + ", which is at " + program.getVersion());
		}
		// The cover and the address are looked up before anything is changed: a query after a change would first
		// write the half of the save made so far.
		UUID cover = request.coverFileId();
		UUID replacedCover = Objects.equals(program.getCoverFileId(), cover) ? null : program.getCoverFileId();
		if (cover != null && !cover.equals(program.getCoverFileId())) {
			requireUsableCover(actor, id, cover);
		}
		boolean moved = !program.getSlug().equals(request.slug());
		if (moved) {
			if (program.hasBeenPublished()) {
				throw new ProgramException(ProgramErrorCode.SLUG_FIXED,
						"New address for program " + id + ", which has been published");
			}
			if (programs.existsBySlug(request.slug())) {
				throw slugTaken(request.slug(), null);
			}
		}
		PageKind pageKind = PageKind.valueOf(request.pageKind().toUpperCase(Locale.ROOT));
		String externalUrl = text(request.externalUrl());
		if (pageKind == PageKind.EXTERNAL && externalUrl == null) {
			throw refused(ProgramErrorCode.EXTERNAL_URL_REQUIRED, id);
		}
		if (request.startsOn() != null && request.endsOn() != null && request.endsOn().isBefore(request.startsOn())) {
			throw refused(ProgramErrorCode.DAYS_OUT_OF_ORDER, id);
		}
		program.moveTo(request.slug());
		program.describe(request.name().strip(), ProgramType.of(request.type()), text(request.partnerName()),
				text(request.summary()), text(request.about()));
		program.runBetween(request.startsOn(), request.endsOn());
		program.showAs(pageKind, externalUrl);
		takeApplications(program, request.applications());
		program.schedule(milestones(id, request.keyDates()), events(id, request.events()));
		program.coverWith(cover);
		try {
			programs.flush();
		}
		catch (DataIntegrityViolationException raced) {
			// Another save took the address or the cover after this one looked; the unique constraint decided.
			String constraint = constraint(raced);
			if (SLUG_KEY.equals(constraint)) {
				throw slugTaken(request.slug(), raced);
			}
			if (COVER_KEY.equals(constraint)) {
				throw new ProgramException(ProgramErrorCode.COVER_NOT_USABLE,
						"File " + cover + " became the cover of another program", raced);
			}
			throw raced;
		}
		record(AuditAction.PROGRAM_UPDATE, operator, program);
		if (replacedCover != null) {
			// The program no longer names the file, so nothing does. It goes once the save has committed.
			events.publishEvent(new ReplacedCovers.CoverReplaced(id, replacedCover));
		}
		return response(program);
	}

	private static void takeApplications(Program program, @Nullable ProgramApplications applications) {
		if (applications == null) {
			program.takeNoApplications();
			return;
		}
		if (!applications.opensAt().isBefore(applications.closesAt())) {
			throw refused(ProgramErrorCode.WINDOW_OUT_OF_ORDER, program.getId());
		}
		LocalDate outcomesDueOn = applications.outcomesDueOn();
		if (outcomesDueOn != null && outcomesDueOn.isBefore(applications.closesAt().atZone(ZONE).toLocalDate())) {
			throw refused(ProgramErrorCode.OUTCOMES_BEFORE_CLOSE, program.getId());
		}
		program.takeApplications(applications.opensAt(), applications.closesAt(), applications.shortlistSize(),
				outcomesDueOn, applications.allowUpdatesUntilClose());
	}

	private static List<ProgramMilestone> milestones(UUID id, List<ProgramKeyDate> keyDates) {
		return keyDates.stream().map(keyDate -> {
			if (outOfOrder(keyDate.startsAt(), keyDate.endsAt())) {
				throw refused(ProgramErrorCode.KEY_DATE_OUT_OF_ORDER, id);
			}
			return new ProgramMilestone(keyDate.title().strip(), keyDate.startsAt(), keyDate.endsAt(),
					keyDate.allDay(), text(keyDate.note()));
		}).toList();
	}

	private static List<ProgramEvent> events(UUID id, List<ProgramEventEntry> events) {
		return events.stream().map(event -> {
			if (outOfOrder(event.startsAt(), event.endsAt())) {
				throw refused(ProgramErrorCode.EVENT_OUT_OF_ORDER, id);
			}
			return new ProgramEvent(event.title().strip(), event.startsAt(), event.endsAt(), event.online(),
					text(event.city()), text(event.country()), text(event.registrationUrl()));
		}).toList();
	}

	/** A cover is a stored image the caller uploaded, and the cover of no other program. */
	private void requireUsableCover(Actor actor, UUID id, UUID cover) {
		try {
			storage.stored(cover, FilePurpose.PROGRAM_IMAGE, actor);
		}
		catch (StorageException notUsable) {
			throw new ProgramException(ProgramErrorCode.COVER_NOT_USABLE,
					"File " + cover + " as the cover of program " + id, notUsable);
		}
		if (programs.existsByCoverFileId(cover)) {
			throw new ProgramException(ProgramErrorCode.COVER_NOT_USABLE,
					"File " + cover + " is the cover of another program");
		}
	}

	/**
	 * Puts the program on the public site. The first publication fixes its address. Publishing a published program
	 * changes nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when the program does not exist, or it still lacks what publishing needs
	 */
	@Transactional
	public void publish(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Program program = programs.findForUpdate(id).orElseThrow(() -> notFound(id));
		List<PublishIssue> issues = PublishIssue.of(program);
		if (!issues.isEmpty()) {
			throw new ProgramException(ProgramErrorCode.NOT_READY_TO_PUBLISH,
					"Publication of program " + id + " refused: " + issues);
		}
		if (program.publish(Instant.now())) {
			record(AuditAction.PROGRAM_PUBLISH, operator, program);
		}
	}

	/**
	 * Takes the program off the public site; it keeps everything, its address included. Unpublishing a draft changes
	 * nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ProgramException when the program does not exist
	 */
	@Transactional
	public void unpublish(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		Program program = programs.findForUpdate(id).orElseThrow(() -> notFound(id));
		if (program.unpublish()) {
			record(AuditAction.PROGRAM_UNPUBLISH, operator, program);
		}
	}

	private void record(AuditAction action, Operator operator, Program program) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(PROGRAM, program.getId().toString(), program.getName()), Map.of()));
	}

	private static AdminProgramResponse response(Program program) {
		Instant opensAt = program.getApplicationsOpenAt();
		Instant closesAt = program.getApplicationsCloseAt();
		return new AdminProgramResponse(program.getId(), program.getSlug(), program.hasBeenPublished(),
				PublishIssue.of(program).stream().map(PublishIssue::code).toList(), program.getName(), program.getType().code(), program.getPartnerName(), program.getSummary(),
				program.getAbout(), program.getStartsOn(), program.getEndsOn(), program.getStatus().code(),
				program.getPageKind().code(), program.getExternalUrl(), program.getCoverFileId(),
				opensAt == null || closesAt == null ? null
						: new ProgramApplications(opensAt, closesAt, program.getShortlistSize(),
								program.getOutcomesDueOn(), program.isAllowUpdatesUntilClose()),
				program.getMilestones()
					.stream()
					.map(milestone -> new ProgramKeyDate(milestone.title(), milestone.startsAt(), milestone.endsAt(),
							milestone.allDay(), milestone.note()))
					.toList(),
				program.getEvents()
					.stream()
					.map(event -> new ProgramEventEntry(event.title(), event.startsAt(), event.endsAt(),
							event.online(), event.city(), event.country(), event.registrationUrl()))
					.toList(),
				program.getVersion(), program.getCreatedAt(), program.getUpdatedAt());
	}

	private static boolean outOfOrder(Instant startsAt, @Nullable Instant endsAt) {
		return endsAt != null && endsAt.isBefore(startsAt);
	}

	/** What a person typed, or null when they typed nothing. */
	private static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	/** The unique constraint a write broke, as the database names it. */
	private static @Nullable String constraint(DataIntegrityViolationException failure) {
		for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
			if (cause instanceof ConstraintViolationException violation) {
				return violation.getConstraintName();
			}
		}
		return null;
	}

	private static ProgramException notFound(UUID id) {
		return new ProgramException(ProgramErrorCode.PROGRAM_NOT_FOUND, "No program " + id);
	}

	private static ProgramException refused(ProgramErrorCode code, UUID id) {
		return new ProgramException(code, "Save of program " + id + " refused: " + code.code());
	}

	private static ProgramException slugTaken(String slug, @Nullable Throwable cause) {
		String message = "The address " + slug + " is taken";
		return cause == null ? new ProgramException(ProgramErrorCode.SLUG_TAKEN, message)
				: new ProgramException(ProgramErrorCode.SLUG_TAKEN, message, cause);
	}

}
