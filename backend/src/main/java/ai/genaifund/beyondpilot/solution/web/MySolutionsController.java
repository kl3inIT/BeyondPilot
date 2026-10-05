package ai.genaifund.beyondpilot.solution.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.solution.SolutionService;
import ai.genaifund.beyondpilot.solution.dto.CreateSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.MySolutionsResponse;
import ai.genaifund.beyondpilot.solution.dto.SaveSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The solutions of the caller's organization. */
@RestController
@RequestMapping("/api/solution/mine")
@Tag(name = "My solutions", description = "The solutions of the caller's organization.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MySolutionsController.PROBLEM)))
class MySolutionsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_WRITER = "The caller is not an owner of an approved organization that is a provider.";

	private static final String NOT_FOUND = "The caller's organization has no such solution.";

	private final SolutionService solutions;

	MySolutionsController(SolutionService solutions) {
		this.solutions = solutions;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMySolutions", summary = "The solutions of the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The solutions, the newest first.")
	MySolutionsResponse list(@CurrentActor Actor actor) {
		return solutions.mine(actor);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createSolution", summary = "Create a solution as a draft",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The draft.")
	@ApiResponse(responseCode = "400", description = "The name is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_WRITER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse create(@CurrentActor Actor actor, @Valid @RequestBody CreateSolutionRequest request) {
		return solutions.create(actor, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMySolution", summary = "One solution of the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The solution.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return solutions.get(actor, id);
	}

	@PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveSolution", summary = "Save a solution",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The solution as saved, with its new version.")
	@ApiResponse(responseCode = "400",
			description = "A member is not valid, or a submitted or approved solution would lose what a submission needs.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_WRITER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse save(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveSolutionRequest request) {
		return solutions.save(actor, id, request);
	}

	@PostMapping(path = "/{id}/submit", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "submitSolution", summary = "Send a solution to GenAI Fund for review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The solution, waiting for review.")
	@ApiResponse(responseCode = "400", description = "The solution lacks what a submission needs.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_WRITER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution is already submitted or approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse submit(@CurrentActor Actor actor, @PathVariable UUID id) {
		return solutions.submit(actor, id);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "deleteSolutionDraft", summary = "Delete a draft",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The draft is gone.", content = @Content)
	@ApiResponse(responseCode = "403", description = NOT_WRITER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution is not a draft.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void delete(@CurrentActor Actor actor, @PathVariable UUID id) {
		solutions.delete(actor, id);
	}
}
