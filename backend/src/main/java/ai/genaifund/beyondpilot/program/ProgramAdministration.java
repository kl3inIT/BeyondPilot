package ai.genaifund.beyondpilot.program;

import java.util.Map;
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
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramQueryRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramType;
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

	private final ProgramRepository programs;

	private final ProgramQueryRepository programList;

	private final IdentityService identity;

	private final AuditTrail audit;

	ProgramAdministration(ProgramRepository programs, ProgramQueryRepository programList, IdentityService identity,
			AuditTrail audit) {
		this.programs = programs;
		this.programList = programList;
		this.identity = identity;
		this.audit = audit;
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
		return response(programs.findById(id)
			.orElseThrow(() -> new ProgramException(ProgramErrorCode.PROGRAM_NOT_FOUND, "No program " + id)));
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
			throw new ProgramException(ProgramErrorCode.SLUG_TAKEN, "The address " + request.slug() + " is taken");
		}
		Program program;
		try {
			program = programs.saveAndFlush(
					new Program(request.slug(), request.name().strip(), ProgramType.of(request.type())));
		}
		catch (DataIntegrityViolationException raced) {
			// Two operators created the same address at the same moment; the unique constraint decided.
			throw new ProgramException(ProgramErrorCode.SLUG_TAKEN, "The address " + request.slug() + " is taken",
					raced);
		}
		record(AuditAction.PROGRAM_CREATE, operator, program);
		return response(program);
	}

	private void record(AuditAction action, Operator operator, Program program) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(PROGRAM, program.getId().toString(), program.getName()), Map.of()));
	}

	private static AdminProgramResponse response(Program program) {
		return new AdminProgramResponse(program.getId(), program.getSlug(), program.getName(),
				program.getType().code(), program.getPartnerName(), program.getSummary(), program.getAbout(),
				program.getStartsOn(), program.getEndsOn(), program.getStatus().code(), program.getPageKind().code(),
				program.getExternalUrl(), program.getVersion(), program.getCreatedAt(), program.getUpdatedAt());
	}

}
