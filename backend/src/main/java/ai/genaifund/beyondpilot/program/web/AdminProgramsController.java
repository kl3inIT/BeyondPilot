package ai.genaifund.beyondpilot.program.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.program.ProgramAdministration;
import ai.genaifund.beyondpilot.program.dto.AdminProgramListResponse;
import ai.genaifund.beyondpilot.program.dto.AdminProgramResponse;
import ai.genaifund.beyondpilot.program.dto.CreateProgramRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The operators' work on programs: every program in any status, read by its identifier. */
@RestController
@RequestMapping("/api/program/admin/programs")
@Tag(name = "Program administration", description = "The programs operators create and edit.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminProgramsController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminProgramsController.PROBLEM)))
class AdminProgramsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final ProgramAdministration programs;

	AdminProgramsController(ProgramAdministration programs) {
		this.programs = programs;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminPrograms", summary = "Every program, the newest first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Every program in any status.")
	AdminProgramListResponse list(@CurrentActor Actor actor) {
		return programs.list(actor);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createProgram", summary = "Create a program as a draft",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The draft.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another program already has this address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminProgramResponse create(@CurrentActor Actor actor, @Valid @RequestBody CreateProgramRequest request) {
		return programs.create(actor, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminProgram", summary = "One program as an operator edits it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The program.")
	@ApiResponse(responseCode = "404", description = "There is no such program.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminProgramResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return programs.get(actor, id);
	}

}
