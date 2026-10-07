package ai.genaifund.beyondpilot.solution.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.solution.SolutionAdministration;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.RejectSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SendBackSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionBackingRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionResponse;
import ai.genaifund.beyondpilot.solution.dto.TakeDownSolutionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The operators' review of submitted solutions. */
@RestController
@RequestMapping("/api/solution/admin/solutions")
@Tag(name = "Solution administration", description = "The solutions operators review.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminSolutionsController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminSolutionsController.PROBLEM)))
class AdminSolutionsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "There is no such submitted solution.";

	private final SolutionAdministration solutions;

	AdminSolutionsController(SolutionAdministration solutions) {
		this.solutions = solutions;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminSolutions", summary = "The submitted solutions, those waiting for review first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the solutions the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminSolutionListResponse list(@CurrentActor Actor actor, @Valid @ParameterObject AdminSolutionListRequest request) {
		return solutions.list(actor, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminSolution", summary = "One solution as an operator reviews it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The solution.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return solutions.get(actor, id);
	}

	@PostMapping("/{id}/approve")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "approveSolution", summary = "Approve a solution that waits for review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution is approved.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution is not waiting for review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void approve(@CurrentActor Actor actor, @PathVariable UUID id) {
		solutions.approve(actor, id);
	}

	@PutMapping(path = "/{id}/backing", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "backSolution",
			summary = "Write what GenAI Fund says of a solution: who backs its company, its programme and its funding",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "What GenAI Fund says of the solution is written.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void back(@CurrentActor Actor actor, @PathVariable UUID id, @Valid @RequestBody SolutionBackingRequest request) {
		solutions.back(actor, id, request);
	}

	@PostMapping(path = "/{id}/send-back", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "sendBackSolution",
			summary = "Send a solution that waits for review back to its owners, with what to change",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution needs changes; its owners are told.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "The reason is blank or longer than 1000 characters.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution is not waiting for review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void sendBack(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SendBackSolutionRequest request) {
		solutions.sendBack(actor, id, request);
	}

	@PostMapping(path = "/{id}/reject", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "rejectSolution", summary = "Refuse a solution that waits for review for good",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution is rejected, with the reason.", content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution is not waiting for review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void reject(@CurrentActor Actor actor, @PathVariable UUID id, @Valid @RequestBody RejectSolutionRequest request) {
		solutions.reject(actor, id, request);
	}

	@PostMapping(path = "/{id}/take-down", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "takeDownSolution",
			summary = "Take an approved solution out of the directory and matching, with a reason",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution is taken down; its review stays approved.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution is not approved, or is already taken down.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void takeDown(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody TakeDownSolutionRequest request) {
		solutions.takeDown(actor, id, request);
	}

	@PostMapping("/{id}/restore")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "restoreSolution",
			summary = "Put a solution that was taken down back, without a new review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution is back.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution is not taken down.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void restore(@CurrentActor Actor actor, @PathVariable UUID id) {
		solutions.restore(actor, id);
	}
}
