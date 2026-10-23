package ai.genaifund.beyondpilot.program.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.program.EventRegistrations;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.program.dto.EventRegistrationResponse;
import ai.genaifund.beyondpilot.program.dto.ProgramListRequest;
import ai.genaifund.beyondpilot.program.dto.ProgramListResponse;
import ai.genaifund.beyondpilot.program.dto.ProgramResponse;
import ai.genaifund.beyondpilot.program.dto.RegisterForEventRequest;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The programs as visitors read them, without a session. */
@RestController
@RequestMapping("/api/program/programs")
@Tag(name = "Programs", description = "The programs GenAI Fund runs, as the public site shows them.")
class ProgramsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final ProgramService programs;

	private final EventRegistrations registrations;

	ProgramsController(ProgramService programs, EventRegistrations registrations) {
		this.programs = programs;
		this.registrations = registrations;
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

	@GetMapping(path = "/{slug}/registration", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getEventRegistration", summary = "How to register for an event here, and the caller's registration",
			description = "For an event of GenAI Fund's Luma calendar that people register for on BeyondPilot (BEY-245).")
	@ApiResponse(responseCode = "200", description = "The form, and the caller's registration when there is one.")
	@ApiResponse(responseCode = "404",
			description = "No program is published at this address (`PROGRAM_NOT_FOUND`), or people register for it on Luma (`PROGRAM_REGISTRATION_NOT_HERE`).",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EventRegistrationResponse registration(@PathVariable String slug, @CurrentActor @Nullable Actor actor) {
		return registrations.registration(slug, actor);
	}

	@PostMapping(path = "/{slug}/registration", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "registerForEvent", summary = "Register the caller for an event",
			description = "Kept at once and sent to Luma right after, with Luma's own email off; the caller is emailed what became of it.")
	@ApiResponse(responseCode = "200", description = "The registration, `received` until Luma has it.")
	@ApiResponse(responseCode = "400",
			description = "The request or an answer is not valid (`PROGRAM_REGISTRATION_ANSWERS_INVALID`).",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "`PROGRAM_NOT_FOUND` or `PROGRAM_REGISTRATION_NOT_HERE`.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "Already registered (`PROGRAM_REGISTRATION_EXISTS`), the questions changed (`PROGRAM_REGISTRATION_FORM_CHANGED`) or the event takes no more (`PROGRAM_REGISTRATION_CLOSED`).",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EventRegistrationResponse register(@PathVariable String slug, @CurrentActor Actor actor,
			@Valid @RequestBody RegisterForEventRequest request) {
		return registrations.register(actor, slug, request);
	}

}
