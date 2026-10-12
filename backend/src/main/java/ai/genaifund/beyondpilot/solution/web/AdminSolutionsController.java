package ai.genaifund.beyondpilot.solution.web;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.solution.SolutionAdministration;
import ai.genaifund.beyondpilot.solution.dto.AdminCreateSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminSolutionOrganizationOptionResponse;
import ai.genaifund.beyondpilot.solution.dto.RejectSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SaveSolutionRequest;
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
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

	private static final String DRAFT_ONLY = "The solution is not a draft.";

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

	@GetMapping(path = "/organizations", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminSolutionOrganizations",
			summary = "The approved organizations a solution can be started for, by name; at most 50",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The organizations, by name.")
	List<AdminSolutionOrganizationOptionResponse> organizationsToStartFor(@CurrentActor Actor actor,
			@RequestParam(required = false) @Nullable String q) {
		return solutions.organizationsToStartFor(actor, q);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createAdminSolution", summary = "Start a solution as a draft of an approved organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The draft.")
	@ApiResponse(responseCode = "400", description = "The name is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The organization is not approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse create(@CurrentActor Actor actor, @Valid @RequestBody AdminCreateSolutionRequest request) {
		return solutions.create(actor, request);
	}

	@GetMapping(path = "/{id}/draft", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminSolutionDraft", summary = "A draft as the editor of an operator reads it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The draft.")
	@ApiResponse(responseCode = "404", description = "There is no such solution.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = DRAFT_ONLY,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse draft(@CurrentActor Actor actor, @PathVariable UUID id) {
		return solutions.draft(actor, id);
	}

	@PutMapping(path = "/{id}/draft", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveAdminSolutionDraft", summary = "Save a draft as the editor of an operator holds it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The draft as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such solution.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The draft changed since it was read, or the solution is not a draft.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SolutionResponse saveDraft(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveSolutionRequest request) {
		return solutions.saveDraft(actor, id, request);
	}

	@PostMapping("/{id}/publish")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "publishAdminSolution", summary = "Publish a draft at once, with no review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution is approved.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The draft lacks what a submission needs.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such solution.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = DRAFT_ONLY + " Or its organization is not approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void publish(@CurrentActor Actor actor, @PathVariable UUID id) {
		solutions.publish(actor, id);
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

	@PostMapping("/{id}/feature")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "featureSolution",
			summary = "Feature a solution: it comes first in the opening view of the public directory",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution is featured; one featured already keeps its place.",
			content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void feature(@CurrentActor Actor actor, @PathVariable UUID id) {
		solutions.feature(actor, id);
	}

	@PostMapping("/{id}/unfeature")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "unfeatureSolution", summary = "Stop featuring a solution",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The solution is not featured.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void unfeature(@CurrentActor Actor actor, @PathVariable UUID id) {
		solutions.unfeature(actor, id);
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
