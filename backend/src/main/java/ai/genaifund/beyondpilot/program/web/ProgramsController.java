package ai.genaifund.beyondpilot.program.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.program.dto.ProgramListRequest;
import ai.genaifund.beyondpilot.program.dto.ProgramListResponse;
import ai.genaifund.beyondpilot.program.dto.ProgramResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The programs as visitors read them, without a session. */
@RestController
@RequestMapping("/api/program/programs")
@Tag(name = "Programs", description = "The programs GenAI Fund runs, as the public site shows them.")
class ProgramsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final ProgramService programs;

	ProgramsController(ProgramService programs) {
		this.programs = programs;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listPrograms", summary = "The published programs, the latest to start first")
	@ApiResponse(responseCode = "200", description = "The programs the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ProgramListResponse list(@Valid @ParameterObject ProgramListRequest request) {
		return programs.list(request);
	}

	@GetMapping(path = "/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getProgram", summary = "A program's public page",
			description = "A published program, or a draft when an operator previews it.")
	@ApiResponse(responseCode = "200", description = "The program.")
	@ApiResponse(responseCode = "404", description = "No program is published at this address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ProgramResponse get(@PathVariable String slug, @CurrentActor @Nullable Actor actor) {
		return programs.get(slug, actor);
	}

}
