package ai.genaifund.beyondpilot.program;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.program.dto.ProgramApplications;
import ai.genaifund.beyondpilot.program.dto.ProgramEventEntry;
import ai.genaifund.beyondpilot.program.dto.ProgramKeyDate;
import ai.genaifund.beyondpilot.program.dto.ProgramListRequest;
import ai.genaifund.beyondpilot.program.dto.ProgramListResponse;
import ai.genaifund.beyondpilot.program.dto.ProgramResponse;
import ai.genaifund.beyondpilot.program.persistence.PageKind;
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramQueryRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramStatus;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The programs as visitors see them: published ones only, except that an operator also sees a draft's page. */
@Service
public class ProgramService {

	private final ProgramRepository programs;

	private final ProgramQueryRepository programList;

	private final IdentityService identity;

	ProgramService(ProgramRepository programs, ProgramQueryRepository programList, IdentityService identity) {
		this.programs = programs;
		this.programList = programList;
		this.identity = identity;
	}

	/** The published programs the request selects, the latest to start first. */
	@Transactional(readOnly = true)
	public ProgramListResponse list(ProgramListRequest request) {
		Instant now = Instant.now();
		String phase = request.phase();
		return new ProgramListResponse(programList.published(request.type(), now)
			.stream()
			.filter(program -> phase == null || phase.equals(program.phase()))
			.toList());
	}

	/** The application form of a published program that takes applications; empty for any other address. */
	@Transactional(readOnly = true)
	public Optional<ApplicationForm> applicationForm(String slug) {
		return programs.findBySlug(slug).flatMap(ProgramService::form);
	}

	/** The application forms of these programs by identifier; a draft or one that takes no applications is left out. */
	@Transactional(readOnly = true)
	public Map<UUID, ApplicationForm> applicationForms(Collection<UUID> programIds) {
		return programs.findAllById(programIds)
			.stream()
			.flatMap(program -> form(program).stream())
			.collect(Collectors.toMap(ApplicationForm::programId, Function.identity()));
	}

	/**
	 * The application forms of these programs as their applications are reviewed: whatever the program's status, for
	 * one taken off the site after its close is still judged. A program that takes no applications is left out.
	 */
	@Transactional(readOnly = true)
	public Map<UUID, ApplicationForm> formsUnderReview(Collection<UUID> programIds) {
		return programs.findAllById(programIds)
			.stream()
			.flatMap(program -> windowed(program).stream())
			.collect(Collectors.toMap(ApplicationForm::programId, Function.identity()));
	}

	private static Optional<ApplicationForm> form(Program program) {
		return program.getStatus() == ProgramStatus.PUBLISHED ? windowed(program) : Optional.empty();
	}

	private static Optional<ApplicationForm> windowed(Program program) {
		Instant opensAt = program.getApplicationsOpenAt();
		Instant closesAt = program.getApplicationsCloseAt();
		if (opensAt == null || closesAt == null) {
			return Optional.empty();
		}
		return Optional.of(new ApplicationForm(program.getId(), program.getSlug(), program.getName(), opensAt,
				closesAt, program.getOutcomesDueOn(), program.isAllowUpdatesUntilClose(),
				program.getQuestions()
					.stream()
					.map(question -> new ApplicationForm.Question(question.id(), question.kind(), question.label(),
							question.help(), question.required(), List.of(question.options()), question.maxLength()))
					.toList()));
	}

	/** The program as search indexes it, while it is published; empty for a draft or a program that is gone. */
	@Transactional(readOnly = true)
	public Optional<IndexedProgram> indexed(UUID id) {
		return programs.findById(id)
			.filter(program -> program.getStatus() == ProgramStatus.PUBLISHED)
			.map(ProgramService::indexed);
	}

	/** Every published program as search indexes it, for a rebuild of the index. */
	@Transactional(readOnly = true)
	public List<IndexedProgram> indexedAll() {
		return programs.findByStatus(ProgramStatus.PUBLISHED).stream().map(ProgramService::indexed).toList();
	}

	private static IndexedProgram indexed(Program program) {
		return new IndexedProgram(program.getId(), program.getSlug(), program.getName(), program.getType().code(),
				program.getPartnerName(), program.getSummary(), program.getAbout(), program.getCoverFileId(),
				program.getPageKind() == PageKind.EXTERNAL ? program.getExternalUrl() : null, program.getStartsOn(),
				program.getEndsOn(), program.getApplicationsOpenAt(), program.getApplicationsCloseAt());
	}

	/**
	 * A program's public page. A draft is found only by an operator, who previews it before publishing.
	 * @param actor the signed-in caller, or null for a visitor
	 * @throws ProgramException when no program has this address, or it is a draft and the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public ProgramResponse get(String slug, @Nullable Actor actor) {
		Program program = programs.findBySlug(slug)
			.filter(found -> found.getStatus() == ProgramStatus.PUBLISHED || (actor != null && identity.isOperator(actor)))
			.orElseThrow(() -> new ProgramException(ProgramErrorCode.PROGRAM_NOT_FOUND, "No public program " + slug));
		Instant opensAt = program.getApplicationsOpenAt();
		Instant closesAt = program.getApplicationsCloseAt();
		return new ProgramResponse(program.getId(), program.getSlug(), program.getName(), program.getType().code(),
				program.getPartnerName(), program.getSummary(), program.getAbout(), program.getCoverFileId(),
				ProgramPhase.of(program.getStartsOn(), program.getEndsOn(), opensAt, closesAt, Instant.now()).code(),
				program.getStartsOn(), program.getEndsOn(), program.getPageKind().code(), program.getExternalUrl(),
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
				program.getStatus().code());
	}

}
